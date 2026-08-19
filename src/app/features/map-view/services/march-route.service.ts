import { Injectable, inject } from '@angular/core';
import { TerrainService } from './terrain.service';
import * as maplibregl from 'maplibre-gl';

export type ColumnType = 'wheel' | 'caterpillar' | 'mixed' | 'foot';

export interface MarchSegment {
  from: [number, number];
  to: [number, number];
  distanceKm: number;
  roadType: string;
  elevationSlope: number;
  speedKmH: number;
  durationHrs: number;
}

export interface MarchRoute {
  segments: MarchSegment[];
  totalDistanceKm: number;
  totalDurationHrs: number;
  sharpTurnCount: number;
  bridgeCount: number;
  totalBarriers: number;
}

export interface BelarusPlace {
  id: string;
  name: string;
  nameBe: string;
  type: string;
  region: string;
  coords: [number, number];
  population?: number;
  nodeId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarchRouteService {
  private terrainService: TerrainService | null = null;
  private placesCache: BelarusPlace[] = [];

  constructor() {
    try {
      this.terrainService = inject(TerrainService, { optional: true });
    } catch {}
  }

  async searchPlaces(query: string): Promise<BelarusPlace[]> {
    const q = query.trim().toLowerCase();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<BelarusPlace[]>('search_belarus_places', { query: q });
    } catch {
      if (this.placesCache.length === 0) {
        try {
          const res = await fetch('/assets/belarus_places.json');
          if (res.ok) {
            this.placesCache = await res.json();
          }
        } catch {}
      }
      if (!q) return this.placesCache.slice(0, 10);
      return this.placesCache.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.nameBe && p.nameBe.toLowerCase().includes(q)) ||
        p.region.toLowerCase().includes(q)
      );
    }
  }

  async calculateGraphRoute(
    origin: [number, number],
    destination: [number, number],
    waypoints: [number, number][] = [],
    columnType: ColumnType = 'wheel'
  ): Promise<{ coordinates: [number, number][]; routeStats: MarchRoute }> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<any>('calculate_march_route', {
        origin,
        destination,
        waypoints,
        columnType
      });

      const segments: MarchSegment[] = (res.segments || []).map((s: any) => ({
        from: s.from,
        to: s.to,
        distanceKm: s.distanceKm,
        roadType: s.roadType,
        elevationSlope: 0,
        speedKmH: s.speedKmH,
        durationHrs: s.durationHrs
      }));

      return {
        coordinates: res.coordinates || [origin, destination],
        routeStats: {
          segments,
          totalDistanceKm: res.totalDistanceKm || 0,
          totalDurationHrs: res.totalDurationHrs || 0,
          sharpTurnCount: res.sharpTurnCount || 0,
          bridgeCount: res.bridgeCount || 0,
          totalBarriers: res.totalBarriers || 0
        }
      };
    } catch (err) {
      return this.calculateWebFallbackGraphRoute(origin, destination, waypoints, columnType);
    }
  }

  private async calculateWebFallbackGraphRoute(
    origin: [number, number],
    destination: [number, number],
    waypoints: [number, number][] = [],
    columnType: ColumnType = 'wheel'
  ): Promise<{ coordinates: [number, number][]; routeStats: MarchRoute }> {
    try {
      const resp = await fetch('/assets/belarus_graph.json');
      if (resp.ok) {
        const graphData = await resp.json();
        const nodes: Array<{ id: number; coords: [number, number] }> = graphData.nodes || [];
        const edges: Array<any> = graphData.edges || [];

        if (nodes.length > 0 && edges.length > 0) {
          const adj = new Map<number, any[]>();
          edges.forEach(e => {
            let list = adj.get(e.from);
            if (!list) {
              list = [];
              adj.set(e.from, list);
            }
            list.push(e);
          });

          const cellSize = 0.05;
          const spatialGrid = new Map<string, number[]>();
          nodes.forEach(n => {
            const cx = Math.floor(n.coords[0] / cellSize);
            const cy = Math.floor(n.coords[1] / cellSize);
            const key = `${cx}_${cy}`;
            let list = spatialGrid.get(key);
            if (!list) {
              list = [];
              spatialGrid.set(key, list);
            }
            list.push(n.id);
          });

          const findNearestNode = (pt: [number, number]): number => {
            const cx = Math.floor(pt[0] / cellSize);
            const cy = Math.floor(pt[1] / cellSize);
            let minD = Infinity;
            let bestId = 0;

            for (let r = 0; r <= 3; r++) {
              for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                  const key = `${cx + dx}_${cy + dy}`;
                  const list = spatialGrid.get(key);
                  if (list) {
                    for (const id of list) {
                      const d = this.getDistance(pt, nodes[id].coords);
                      if (d < minD) {
                        minD = d;
                        bestId = id;
                      }
                    }
                  }
                }
              }
              if (minD < Infinity) break;
            }

            if (minD === Infinity) {
              nodes.forEach(n => {
                const d = this.getDistance(pt, n.coords);
                if (d < minD) {
                  minD = d;
                  bestId = n.id;
                }
              });
            }
            return bestId;
          };

          const pointsToVisit: [number, number][] = [origin, ...waypoints, destination];
          const fullPathEdges: Array<{ from: number; to: number; edge: any }> = [];

          for (let i = 0; i < pointsToVisit.length - 1; i++) {
            const startNode = findNearestNode(pointsToVisit[i]);
            const endNode = findNearestNode(pointsToVisit[i + 1]);

            if (startNode === endNode) continue;

            const targetCoords = nodes[endNode].coords;
            const dists = new Map<number, number>();
            const prev = new Map<number, { node: number; edge: any }>();
            
            const openHeap: Array<{ node: number; f: number }> = [];
            const pushHeap = (item: { node: number; f: number }) => {
              openHeap.push(item);
              let idx = openHeap.length - 1;
              while (idx > 0) {
                const parentIdx = Math.floor((idx - 1) / 2);
                if (openHeap[idx].f >= openHeap[parentIdx].f) break;
                const temp = openHeap[idx];
                openHeap[idx] = openHeap[parentIdx];
                openHeap[parentIdx] = temp;
                idx = parentIdx;
              }
            };
            const popHeap = (): { node: number; f: number } | undefined => {
              if (openHeap.length === 0) return undefined;
              const top = openHeap[0];
              const bottom = openHeap.pop()!;
              if (openHeap.length > 0) {
                openHeap[0] = bottom;
                let idx = 0;
                while (true) {
                  let left = 2 * idx + 1;
                  let right = 2 * idx + 2;
                  let smallest = idx;
                  if (left < openHeap.length && openHeap[left].f < openHeap[smallest].f) smallest = left;
                  if (right < openHeap.length && openHeap[right].f < openHeap[smallest].f) smallest = right;
                  if (smallest === idx) break;
                  const temp = openHeap[idx];
                  openHeap[idx] = openHeap[smallest];
                  openHeap[smallest] = temp;
                  idx = smallest;
                }
              }
              return top;
            };

            dists.set(startNode, 0);
            pushHeap({ node: startNode, f: this.getDistance(nodes[startNode].coords, targetCoords) / 110 });

            while (openHeap.length > 0) {
              const current = popHeap()!;
              const u = current.node;
              if (u === endNode) break;

              const currentG = dists.get(u) ?? Infinity;
              const currentH = this.getDistance(nodes[u].coords, targetCoords) / 110;
              if (current.f > currentG + currentH + 0.00001) continue;

              const prevNode = prev.get(u)?.node;
              const outEdges = adj.get(u);

              if (outEdges) {
                for (const e of outEdges) {
                  if (e.to === prevNode && outEdges.length > 1) continue;

                  const speed = this.SPEED_LIMITS[columnType][e.roadType] || 35;
                  const edgeCost = e.distanceKm / Math.max(1, speed);
                  const alt = currentG + edgeCost;

                  if (alt < (dists.get(e.to) ?? Infinity)) {
                    dists.set(e.to, alt);
                    prev.set(e.to, { node: u, edge: e });
                    const h = this.getDistance(nodes[e.to].coords, targetCoords) / 110;
                    pushHeap({ node: e.to, f: alt + h });
                  }
                }
              }
            }

            const pathEdges: Array<{ from: number; to: number; edge: any }> = [];
            let curr = endNode;

            while (curr !== startNode) {
              const p = prev.get(curr);
              if (p) {
                pathEdges.push({ from: p.node, to: curr, edge: p.edge });
                curr = p.node;
              } else {
                break;
              }
            }

            if (curr === startNode) {
              pathEdges.reverse();
              fullPathEdges.push(...pathEdges);
            }
          }

          const nodeMap = new Map<number, [number, number]>();
          nodes.forEach(n => nodeMap.set(n.id, n.coords));

          const routeCoords: [number, number][] = [origin];

          for (const pe of fullPathEdges) {
            const edgeGeom = pe.edge?.geometry as [number, number][] | undefined;
            if (edgeGeom && edgeGeom.length > 0) {
              routeCoords.push(...edgeGeom.slice(1));
            } else {
              const toCoord = nodeMap.get(pe.to);
              if (toCoord) routeCoords.push(toCoord);
            }
          }

          if (routeCoords.length > 0) {
            const last = routeCoords[routeCoords.length - 1];
            if (this.getDistance(last, destination) > 0.001) {
              routeCoords.push(destination);
            }
          } else {
            routeCoords.push(origin, destination);
          }

          let totalDist = 0;
          let totalDurationHrs = 0;
          const segments: MarchSegment[] = [];

          for (const pe of fullPathEdges) {
            const fromCoord = nodeMap.get(pe.from) || routeCoords[0];
            const toCoord = nodeMap.get(pe.to) || routeCoords[routeCoords.length - 1];
            const segDist = pe.edge?.distanceKm ?? this.getDistance(fromCoord, toCoord);
            const roadType = pe.edge?.roadType || 'primary';
            const speed = this.SPEED_LIMITS[columnType][roadType] || 35;
            const durationHrs = segDist / speed;

            totalDist += segDist;
            totalDurationHrs += durationHrs;

            segments.push({
              from: fromCoord,
              to: toCoord,
              distanceKm: Math.round(segDist * 100) / 100,
              roadType,
              elevationSlope: 0,
              speedKmH: speed,
              durationHrs: Math.round(durationHrs * 100) / 100
            });
          }

          const sharpTurns = Math.max(0, Math.floor((routeCoords.length - 2) / 3));
          const bridges = Math.floor(totalDist / 45.0);
          const barriers = Math.floor(totalDist / 60.0);

          return {
            coordinates: routeCoords,
            routeStats: {
              segments,
              totalDistanceKm: Math.round(totalDist * 100) / 100,
              totalDurationHrs: Math.round(totalDurationHrs * 100) / 100,
              sharpTurnCount: sharpTurns,
              bridgeCount: bridges,
              totalBarriers: barriers
            }
          };
        }
      }
    } catch {
    }

    const dist = this.getDistance(origin, destination);
    const speed = this.SPEED_LIMITS[columnType]['primary'] || 30;
    return {
      coordinates: [origin, ...waypoints, destination],
      routeStats: {
        segments: [{
          from: origin,
          to: destination,
          distanceKm: dist,
          roadType: 'primary',
          elevationSlope: 0,
          speedKmH: speed,
          durationHrs: dist / speed
        }],
        totalDistanceKm: dist,
        totalDurationHrs: dist / speed,
        sharpTurnCount: 0,
        bridgeCount: 0,
        totalBarriers: 0
      }
    };
  }

  private readonly SPEED_LIMITS: Record<ColumnType, Record<string, number>> = {
    wheel: {
      motorway: 40,
      primary: 35,
      secondary: 30,
      tertiary: 25,
      minor: 20,
      track: 10,
      path: 0
    },
    caterpillar: {
      motorway: 25,
      primary: 25,
      secondary: 20,
      tertiary: 18,
      minor: 15,
      track: 12,
      path: 0
    },
    mixed: {
      motorway: 25,
      primary: 25,
      secondary: 20,
      tertiary: 18,
      minor: 15,
      track: 10,
      path: 0
    },
    foot: {
      motorway: 0,
      primary: 0,
      secondary: 0,
      tertiary: 5,
      minor: 4.5,
      track: 4,
      path: 3.5
    }
  };

  getDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371;
    const dLat = (p2[1] - p1[1]) * Math.PI / 180;
    const dLon = (p2[0] - p1[0]) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  projectPointToSegment(p: [number, number], a: [number, number], b: [number, number]): [number, number] {
    const l2 = Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2);
    if (l2 === 0) return a;
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  snapPointToNearestRoad(map: maplibregl.Map, coord: [number, number]): [number, number] {
    if (!map) return coord;
    try {
      const point = map.project(coord);
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - 30, point.y - 30],
        [point.x + 30, point.y + 30]
      ];
      const features = map.queryRenderedFeatures(bbox, {
        layers: ['roads_major', 'roads_minor', 'transportation_path']
      });

      if (!features || features.length === 0) return coord;

      let minDistanceKm = Infinity;
      let bestSnapped: [number, number] = coord;

      for (const feat of features) {
        const geom = feat.geometry as any;
        if (!geom) continue;

        const lineCoordsList: [number, number][][] = geom.type === 'LineString' 
          ? [geom.coordinates] 
          : (geom.type === 'MultiLineString' ? geom.coordinates : []);

        for (const lineCoords of lineCoordsList) {
          for (let i = 0; i < lineCoords.length - 1; i++) {
            const p1 = lineCoords[i] as [number, number];
            const p2 = lineCoords[i + 1] as [number, number];
            const projected = this.projectPointToSegment(coord, p1, p2);
            const distKm = this.getDistance(coord, projected);
            if (distKm < minDistanceKm) {
              minDistanceKm = distKm;
              bestSnapped = projected;
            }
          }
        }
      }

      return minDistanceKm < 0.5 ? bestSnapped : coord;
    } catch {
      return coord;
    }
  }

  buildSnappedRoute(map: maplibregl.Map, coords: [number, number][]): [number, number][] {
    if (!map || !coords || coords.length < 2) return coords;
    const snapped: [number, number][] = [];
    coords.forEach(c => {
      snapped.push(this.snapPointToNearestRoad(map, c));
    });
    return snapped;
  }

  getRoadTypeFromMap(map: maplibregl.Map, coord: [number, number]): string {
    try {
      const point = map.project(coord);
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - 15, point.y - 15],
        [point.x + 15, point.y + 15]
      ];

      const features = map.queryRenderedFeatures(bbox, {
        layers: ['roads_major', 'roads_minor', 'transportation_path']
      });

      if (features && features.length > 0) {
        const feat = features[0];
        const roadClass = feat.properties?.['class'] || '';
        
        if (roadClass === 'motorway' || roadClass === 'trunk') return 'motorway';
        if (roadClass === 'primary') return 'primary';
        if (roadClass === 'secondary') return 'secondary';
        if (roadClass === 'tertiary') return 'tertiary';
        if (roadClass === 'minor' || roadClass === 'service') return 'minor';
        if (roadClass === 'track') return 'track';
        if (roadClass === 'path') return 'path';
      }
    } catch (e) {
      console.warn('Ошибка при определении типа дороги:', e);
    }
    return 'minor';
  }

  countSharpTurns(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0;
    let sharpTurnCount = 0;
    for (let i = 1; i < coords.length - 1; i++) {
      const p0 = coords[i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];

      const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
      const v2 = [p2[0] - p1[0], p2[1] - p1[1]];

      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.hypot(v1[0], v1[1]);
      const mag2 = Math.hypot(v2[0], v2[1]);

      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
        if (angleDeg >= 90) {
          sharpTurnCount++;
        }
      }
    }
    return sharpTurnCount;
  }

  countBridgeCrossings(map: maplibregl.Map, coords: [number, number][]): number {
    if (!map || !coords || coords.length < 2) return 0;
    let bridgeCount = 0;
    try {
      const styleLayers = map.getStyle()?.layers || [];
      const existingLayerIds = new Set(styleLayers.map(l => l.id));
      const targetLayers = ['water', 'waterway', 'bridge', 'roads_major', 'roads_minor'].filter(id => existingLayerIds.has(id));

      if (targetLayers.length === 0) return 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const point = map.project(midpoint);
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [point.x - 10, point.y - 10],
          [point.x + 10, point.y + 10]
        ];
        const features = map.queryRenderedFeatures(bbox, {
          layers: targetLayers
        });
        if (features && features.length > 0) {
          const isBridgeOrWater = features.some(f => {
            const cls = f.properties?.['class'] || '';
            const layerId = f.layer?.id || '';
            return layerId === 'water' || layerId === 'waterway' || layerId === 'bridge' || cls === 'bridge' || cls === 'river';
          });
          if (isBridgeOrWater) {
            bridgeCount++;
          }
        }
      }
    } catch {}
    return bridgeCount;
  }

  async calculateRouteStats(
    map: maplibregl.Map,
    coords: [number, number][],
    columnType: ColumnType,
    isNight: boolean
  ): Promise<MarchRoute> {
    if (!coords || coords.length < 2) {
      return { segments: [], totalDistanceKm: 0, totalDurationHrs: 0, sharpTurnCount: 0, bridgeCount: 0, totalBarriers: 0 };
    }

    const segments: MarchSegment[] = [];
    let totalDistanceKm = 0;
    let totalDurationHrs = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];

      const distanceKm = this.getDistance(p1, p2);
      totalDistanceKm += distanceKm;

      const midpoint: [number, number] = [
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2
      ];
      const roadType = this.getRoadTypeFromMap(map, midpoint);

      const h1 = this.terrainService ? await this.terrainService.getApproxElevation(p1[0], p1[1]) : 0;
      const h2 = this.terrainService ? await this.terrainService.getApproxElevation(p2[0], p2[1]) : 0;
      const distMeters = distanceKm * 1000;
      const elevationDiff = Math.abs(h1 - h2);
      const elevationSlope = distMeters > 0 ? (elevationDiff / distMeters) * 100 : 0;

      const baseSpeed = this.SPEED_LIMITS[columnType][roadType] || 0;
      let speedKmH = baseSpeed;

      if (speedKmH > 0) {
        if (isNight) {
          speedKmH *= 0.7;
        }
        if (elevationSlope > 8) {
          speedKmH *= 0.6;
        }
      }

      const durationHrs = speedKmH > 0 ? distanceKm / speedKmH : 0;
      totalDurationHrs += durationHrs;

      segments.push({
        from: p1,
        to: p2,
        distanceKm,
        roadType,
        elevationSlope,
        speedKmH,
        durationHrs
      });
    }

    const sharpTurnCount = this.countSharpTurns(coords);
    const bridgeCount = this.countBridgeCrossings(map, coords);
    const totalBarriers = sharpTurnCount + bridgeCount;

    return {
      segments,
      totalDistanceKm,
      totalDurationHrs,
      sharpTurnCount,
      bridgeCount,
      totalBarriers
    };
  }
}
