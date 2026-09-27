import os
import sys
import math
import json
import shutil
from collections import defaultdict, deque
import osmium

GRAPH_PATH = os.path.abspath("src-tauri/assets/belarus_graph.json")
BACKUP_PATH = os.path.abspath("src-tauri/assets/belarus_graph.json.bak")
PBF_PATH = r"C:\Users\user\Downloads\map\belarus.osm.pbf"

SLONIM_BBOX = (25.10, 52.90, 25.50, 53.20)
SNAP_RADIUS_METERS = 22.0
MAX_CONNECTOR_METERS = 45.0

TARGET_HIGHWAYS = {
    'service',
    'footway',
    'path',
    'steps',
    'pedestrian',
    'living_street'
}

def haversine_m(p1, p2):
    R = 6371000.0
    lat1, lon1 = math.radians(p1[1]), math.radians(p1[0])
    lat2, lon2 = math.radians(p2[1]), math.radians(p2[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2.0)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0)**2
    return 2.0 * R * math.asin(math.sqrt(a))

class SlonimWayCollector(osmium.SimpleHandler):
    def __init__(self, bbox):
        super().__init__()
        self.bbox = bbox
        self.ways = []
        self.node_locations = {}
        self.node_usage = defaultdict(int)

    def way(self, w):
        hw = w.tags.get('highway')
        if not hw or hw not in TARGET_HIGHWAYS:
            return

        min_lon, min_lat, max_lon, max_lat = self.bbox
        coords = []
        any_inside = False

        try:
            for n in w.nodes:
                lon = n.location.lon
                lat = n.location.lat
                coords.append((lon, lat, n.ref))
                self.node_locations[n.ref] = (lon, lat)
                if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                    any_inside = True
        except:
            return

        if not any_inside or len(coords) < 2:
            return

        self.ways.append((w.id, hw, coords))
        for _, _, ref in coords:
            self.node_usage[ref] += 1

def main():
    if not os.path.exists(BACKUP_PATH):
        if not os.path.exists(GRAPH_PATH):
            sys.exit(1)
        shutil.copyfile(GRAPH_PATH, BACKUP_PATH)

    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        graph_data = json.load(f)

    nodes = graph_data.get('nodes', [])
    edges = graph_data.get('edges', [])
    initial_nodes_count = len(nodes)
    initial_edges_count = len(edges)

    min_lon, min_lat, max_lon, max_lat = SLONIM_BBOX
    cell_size = 0.002
    grid_existing = defaultdict(list)

    for idx, n in enumerate(nodes):
        c = n['coords']
        if min_lon - 0.05 <= c[0] <= max_lon + 0.05 and min_lat - 0.05 <= c[1] <= max_lat + 0.05:
            key = (int(c[0] / cell_size), int(c[1] / cell_size))
            grid_existing[key].append(idx)

    def snap_to_existing(pt, max_dist=SNAP_RADIUS_METERS):
        cx = int(pt[0] / cell_size)
        cy = int(pt[1] / cell_size)
        best = None
        min_d = max_dist
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for idx in grid_existing.get((cx + dx, cy + dy), []):
                    d = haversine_m(pt, nodes[idx]['coords'])
                    if d < min_d:
                        min_d = d
                        best = idx
        return best, min_d

    collector = SlonimWayCollector(SLONIM_BBOX)
    collector.apply_file(PBF_PATH, locations=True)

    osm_to_graph_node = {}
    next_node_id = initial_nodes_count

    for w_id, hw, coords in collector.ways:
        for i, (lon, lat, ref) in enumerate(coords):
            is_node = (i == 0 or i == len(coords) - 1 or collector.node_usage[ref] > 1)
            if not is_node:
                continue

            if ref not in osm_to_graph_node:
                pt = (lon, lat)
                snapped_id, snapped_d = snap_to_existing(pt, SNAP_RADIUS_METERS)
                if snapped_id is not None:
                    osm_to_graph_node[ref] = snapped_id
                else:
                    nid = next_node_id
                    next_node_id += 1
                    osm_to_graph_node[ref] = nid
                    nodes.append({'id': nid, 'coords': [round(lon, 6), round(lat, 6)]})
                    cx = int(lon / cell_size)
                    cy = int(lat / cell_size)
                    grid_existing[(cx, cy)].append(nid)

    new_edges = []
    for w_id, hw, coords in collector.ways:
        seg_start = 0
        for i in range(1, len(coords)):
            ref = coords[i][2]
            if ref in osm_to_graph_node:
                u_osm = coords[seg_start][2]
                v_osm = ref
                u = osm_to_graph_node[u_osm]
                v = osm_to_graph_node[v_osm]
                if u != v:
                    sub = coords[seg_start:i+1]
                    geom = [[round(c[0], 6), round(c[1], 6)] for c in sub]
                    d_m = sum(haversine_m(sub[k], sub[k+1]) for k in range(len(sub) - 1))
                    dist_km = max(0.001, round(d_m / 1000.0, 3))
                    new_edges.append({
                        'from': u,
                        'to': v,
                        'roadType': hw,
                        'distanceKm': dist_km,
                        'oneWay': False,
                        'geometry': geom
                    })
                seg_start = i

    combined_adj = defaultdict(list)
    for e in edges:
        u, v = e['from'], e['to']
        combined_adj[u].append(v)
        if not e.get('oneWay', False):
            combined_adj[v].append(u)

    for e in new_edges:
        u, v = e['from'], e['to']
        combined_adj[u].append(v)
        combined_adj[v].append(u)

    visited = set()
    components = []
    new_node_ids = set(range(initial_nodes_count, next_node_id))

    for nid in new_node_ids:
        if nid not in visited:
            comp = []
            q = deque([nid])
            visited.add(nid)
            has_existing = False
            while q:
                curr = q.popleft()
                comp.append(curr)
                if curr < initial_nodes_count:
                    has_existing = True
                for nxt in combined_adj[curr]:
                    if nxt not in visited:
                        visited.add(nxt)
                        q.append(nxt)
            components.append((comp, has_existing))

    connector_edges = []
    for comp, has_existing in components:
        if not has_existing:
            best_comp_node = None
            best_road_node = None
            min_dist = MAX_CONNECTOR_METERS

            for nid in comp:
                pt = nodes[nid]['coords']
                snapped_id, snapped_d = snap_to_existing(pt, MAX_CONNECTOR_METERS)
                if snapped_id is not None and snapped_id < initial_nodes_count:
                    if snapped_d < min_dist:
                        min_dist = snapped_d
                        best_comp_node = nid
                        best_road_node = snapped_id

            if best_comp_node is not None and best_road_node is not None:
                p1 = nodes[best_comp_node]['coords']
                p2 = nodes[best_road_node]['coords']
                dist_km = max(0.001, round(min_dist / 1000.0, 3))
                c_edge = {
                    'from': best_comp_node,
                    'to': best_road_node,
                    'roadType': 'footway',
                    'distanceKm': dist_km,
                    'oneWay': False,
                    'geometry': [p1, p2]
                }
                connector_edges.append(c_edge)
                combined_adj[best_comp_node].append(best_road_node)
                combined_adj[best_road_node].append(best_comp_node)

    all_added_edges = new_edges + connector_edges

    slonim_center = [25.323, 53.087]
    cx = int(slonim_center[0] / cell_size)
    cy = int(slonim_center[1] / cell_size)
    seed_node = 0
    seed_d = 1e9
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for idx in grid_existing.get((cx + dx, cy + dy), []):
                if idx < initial_nodes_count:
                    d = haversine_m(slonim_center, nodes[idx]['coords'])
                    if d < seed_d:
                        seed_d = d
                        seed_node = idx

    reachable_from_main = set()
    q = deque([seed_node])
    reachable_from_main.add(seed_node)
    while q:
        curr = q.popleft()
        for nxt in combined_adj[curr]:
            if nxt not in reachable_from_main:
                reachable_from_main.add(nxt)
                q.append(nxt)

    valid_new_edges = []
    for e in all_added_edges:
        if e['from'] in reachable_from_main and e['to'] in reachable_from_main:
            valid_new_edges.append(e)

    used_nodes = set()
    for e in edges:
        used_nodes.add(e['from'])
        used_nodes.add(e['to'])
    for e in valid_new_edges:
        used_nodes.add(e['from'])
        used_nodes.add(e['to'])

    pruned_nodes = []
    old_to_new_id = {}
    for idx, n in enumerate(nodes):
        if idx < initial_nodes_count or idx in used_nodes:
            new_id = len(pruned_nodes)
            old_to_new_id[idx] = new_id
            pruned_nodes.append({
                'id': new_id,
                'coords': n['coords']
            })

    final_edges = []
    for e in edges:
        e_copy = dict(e)
        e_copy['from'] = old_to_new_id[e['from']]
        e_copy['to'] = old_to_new_id[e['to']]
        final_edges.append(e_copy)

    for e in valid_new_edges:
        e_copy = dict(e)
        e_copy['from'] = old_to_new_id[e['from']]
        e_copy['to'] = old_to_new_id[e['to']]
        final_edges.append(e_copy)

    with open(GRAPH_PATH, 'w', encoding='utf-8') as f:
        json.dump({'nodes': pruned_nodes, 'edges': final_edges}, f, ensure_ascii=False)

if __name__ == '__main__':
    main()
