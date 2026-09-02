use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use tauri::http::Response;
use tauri::Manager;

fn resolve_asset_path(app: &tauri::AppHandle, uri_path: &str) -> Result<std::path::PathBuf, String> {
    let decoded_path = uri_path.replace("%20", " ");
    let clean_path = decoded_path.trim_start_matches('/');

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("assets").join(clean_path),
            resource_dir.join(clean_path),
            resource_dir.join("resources").join(clean_path),
            resource_dir.join("_up_").join("assets").join(clean_path),
            resource_dir.join("_up_").join("src-tauri").join("assets").join(clean_path),
            resource_dir.join("_up_").join("public").join("assets").join(clean_path),
            resource_dir.join("_up_").join("dist").join("topos").join("browser").join("assets").join(clean_path),
        ];
        for candidate in &candidates {
            if candidate.exists() {
                return Ok(candidate.clone());
            }
        }
    }

    let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let base_dir = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap_or(&current_dir).to_path_buf()
    } else {
        current_dir.clone()
    };

    let search_paths = [
        base_dir.join("assets").join(clean_path),
        base_dir.join("public").join("assets").join(clean_path),
        base_dir.join("public").join(clean_path),
        base_dir.join("src-tauri").join("assets").join(clean_path),
        base_dir.join("dist").join("topos").join("browser").join("assets").join(clean_path),
        base_dir.join("dist").join("assets").join(clean_path),
        base_dir.join(clean_path),
    ];

    for path in &search_paths {
        if path.exists() {
            return Ok(path.clone());
        }
    }

    Err(format!(
        "File '{}' not found in assets or resource paths",
        clean_path
    ))
}

fn parse_range(range_val: &str, file_len: u64) -> Option<(u64, u64)> {
    if !range_val.starts_with("bytes=") {
        return None;
    }
    let ranges_str = &range_val[6..];
    let mut parts = ranges_str.split('-');
    let start_str = parts.next()?.trim();
    let end_str = parts.next()?.trim();
    
    let start = if start_str.is_empty() {
        0
    } else {
        start_str.parse::<u64>().ok()?
    };
    
    let end = if end_str.is_empty() {
        file_len - 1
    } else {
        end_str.parse::<u64>().ok()?
    };
    
    if start <= end && start < file_len {
        let actual_end = std::cmp::min(end, file_len - 1);
        Some((start, actual_end))
    } else {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .register_uri_scheme_protocol("topos", |ctx, request| {
            if request.method().as_str() == "OPTIONS" {
                return Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "*")
                    .body(Vec::new())
                    .unwrap();
            }

            let uri_str = request.uri().to_string();
            
            let mut relative_path = uri_str.as_str();
            if relative_path.starts_with("topos://") {
                relative_path = &relative_path["topos://".len()..];
            } else if relative_path.starts_with("http://topos.localhost/") {
                relative_path = &relative_path["http://topos.localhost/".len()..];
            } else if relative_path.starts_with("https://topos.localhost/") {
                relative_path = &relative_path["https://topos.localhost/".len()..];
            }
            let relative_path = relative_path.trim_start_matches('/');
            let relative_path = if relative_path.starts_with("localhost/") {
                &relative_path["localhost/".len()..]
            } else {
                relative_path
            };

            let file_path = match resolve_asset_path(ctx.app_handle(), relative_path) {
                Ok(path) => path,
                Err(err) => {
                    log::warn!("{}", err);
                    return Response::builder()
                        .status(404)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                        .header("Access-Control-Allow-Headers", "*")
                        .body(Vec::new())
                        .unwrap();
                }
            };

            let file_len = match std::fs::metadata(&file_path) {
                Ok(meta) => meta.len(),
                Err(_) => 0,
            };

            if request.method().as_str() == "HEAD" {
                return Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "*")
                    .header("Accept-Ranges", "bytes")
                    .header("Content-Length", file_len.to_string())
                    .body(Vec::new())
                    .unwrap();
            }

            let mut file = match File::open(&file_path) {
                Ok(f) => f,
                Err(err) => {
                    log::error!("Failed to open file {:?}: {}", file_path, err);
                    return Response::builder()
                        .status(500)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                        .header("Access-Control-Allow-Headers", "*")
                        .body(Vec::new())
                        .unwrap();
                }
            };

            let range_header = request.headers()
                .get("range")
                .and_then(|h| h.to_str().ok());

            if let Some(range_str) = range_header {
                if let Some((start, end)) = parse_range(range_str, file_len) {
                    let part_len = end - start + 1;
                    
                    if file.seek(SeekFrom::Start(start)).is_ok() {
                        let mut buffer = vec![0; part_len as usize];
                        if file.read_exact(&mut buffer).is_ok() {
                            return Response::builder()
                                .status(206)
                                .header("Access-Control-Allow-Origin", "*")
                                .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                                .header("Access-Control-Allow-Headers", "*")
                                .header("Access-Control-Expose-Headers", "Content-Range")
                                .header("Content-Range", format!("bytes {}-{}/{}", start, end, file_len))
                                .header("Content-Length", part_len.to_string())
                                .header("Content-Type", "application/octet-stream")
                                .body(buffer)
                                .unwrap();
                        }
                    }
                }
            }

            if file_len > 10 * 1024 * 1024 {
                return Response::builder()
                    .status(416)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "*")
                    .header("Accept-Ranges", "bytes")
                    .header("Content-Length", "0")
                    .body(Vec::new())
                    .unwrap();
            }

            let mut buffer = Vec::new();
            if file.read_to_end(&mut buffer).is_ok() {
                Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "*")
                    .header("Content-Length", file_len.to_string())
                    .body(buffer)
                    .unwrap()
            } else {
                Response::builder()
                    .status(500)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
                    .header("Access-Control-Allow-Headers", "*")
                    .body(Vec::new())
                    .unwrap()
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::Builder::new()
                .name("cache-prewarmer".to_string())
                .spawn(move || {
                    let _ = get_cached_places_tree(&handle);
                    let _ = get_cached_dem(&handle);
                    let _ = get_cached_graph(&handle);
                })
                .ok();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_pmtiles_chunk,
            save_scenario_file,
            choose_save_path,
            choose_open_path,
            choose_directory,
            save_scenario_to_path,
            read_file_content,
            export_map_native,
            search_belarus_places,
            calculate_march_route,
            get_elevation_at,
            get_slope_bearing,
            get_elevation_profile,
            calculate_viewshed,
            get_march_overlays
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct PlaceInfo {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default, rename = "nameBe")]
    pub nameBe: String,
    #[serde(default, rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub region: String,
    pub coords: [f64; 2],
    #[serde(default)]
    pub population: Option<u64>,
    #[serde(default, rename = "nodeId")]
    pub nodeId: Option<usize>,
}

#[derive(serde::Deserialize)]
pub struct GraphNode {
    pub id: usize,
    #[serde(default, rename = "placeId")]
    pub placeId: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "nameBe")]
    pub nameBe: Option<String>,
    #[serde(default, rename = "type")]
    pub type_: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    pub coords: [f64; 2],
}

#[derive(serde::Deserialize, Clone)]
pub struct GraphEdge {
    pub from: usize,
    pub to: usize,
    #[serde(default, rename = "fromPlace")]
    pub fromPlace: Option<String>,
    #[serde(default, rename = "toPlace")]
    pub toPlace: Option<String>,
    #[serde(rename = "distanceKm")]
    pub distanceKm: f64,
    #[serde(rename = "roadType")]
    pub roadType: String,
    #[serde(default, rename = "speedKmh")]
    pub speedKmh: Option<f64>,
    #[serde(default, rename = "oneWay")]
    pub oneWay: bool,
    #[serde(default)]
    pub geometry: Option<Vec<[f64; 2]>>,
}

#[derive(serde::Deserialize)]
pub struct GraphData {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub country: String,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(serde::Serialize)]
pub struct RouteSegmentResult {
    pub from: [f64; 2],
    pub to: [f64; 2],
    pub fromPlace: String,
    pub toPlace: String,
    pub distanceKm: f64,
    pub roadType: String,
    pub speedKmH: f64,
    pub durationHrs: f64,
    pub geometry: Option<Vec<[f64; 2]>>,
}

#[derive(serde::Serialize)]
pub struct RouteResult {
    pub coordinates: Vec<[f64; 2]>,
    pub segments: Vec<RouteSegmentResult>,
    pub totalDistanceKm: f64,
    pub totalDurationHrs: f64,
    pub sharpTurnCount: usize,
    pub bridgeCount: usize,
    pub totalBarriers: usize,
}

fn distance_between(p1: [f64; 2], p2: [f64; 2]) -> f64 {
    let r = 6371.0;
    let d_lat = (p2[1] - p1[1]).to_radians();
    let d_lon = (p2[0] - p1[0]).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + p1[1].to_radians().cos() * p2[1].to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

fn get_speed_for_type(column_type: &str, road_type: &str, default_speed: f64) -> f64 {
    match column_type {
        "wheel" => match road_type {
            "motorway" => 40.0,
            "primary" => 35.0,
            "secondary" => 30.0,
            "tertiary" => 25.0,
            _ => default_speed.min(30.0),
        },
        "caterpillar" => match road_type {
            "motorway" => 25.0,
            "primary" => 25.0,
            "secondary" => 20.0,
            "tertiary" => 18.0,
            _ => 15.0,
        },
        "mixed" => match road_type {
            "motorway" => 25.0,
            "primary" => 25.0,
            "secondary" => 20.0,
            "tertiary" => 18.0,
            _ => 15.0,
        },
        "foot" => 4.5,
        _ => default_speed,
    }
}

#[tauri::command]
fn search_belarus_places(app: tauri::AppHandle, query: Option<String>) -> Result<Vec<PlaceInfo>, String> {
    let tree_cache = get_cached_places_tree(&app)?;
    let q = query.unwrap_or_default().trim().to_lowercase();
    
    if q.is_empty() {
        return Ok(tree_cache.places.iter().take(20).cloned().collect());
    }

    let mut scored: Vec<(i64, &PlaceInfo)> = Vec::new();

    for p in &tree_cache.places {
        let name_low = p.name.to_lowercase();
        let name_be_low = p.nameBe.to_lowercase();
        let region_low = p.region.to_lowercase();

        let mut score: i64 = 0;
        let mut matched = false;

        let type_bonus: i64 = match p.type_.as_str() {
            "city" => 500,
            "town" => 200,
            "settlement" => 50,
            "village" => 20,
            _ => 0,
        };
        let pop_bonus: i64 = (p.population.unwrap_or(0) / 1000).min(2000) as i64;

        if name_low == q || name_be_low == q {
            score = 10000 + type_bonus + pop_bonus;
            matched = true;
        } else if name_low.starts_with(&q) || name_be_low.starts_with(&q) {
            let len_diff = (name_low.len() as i64 - q.len() as i64).max(0);
            score = 5000 - (len_diff * 10) + type_bonus + pop_bonus;
            matched = true;
        } else if name_low.contains(&q) || name_be_low.contains(&q) {
            let len_diff = (name_low.len() as i64 - q.len() as i64).max(0);
            score = 2000 - (len_diff * 10) + type_bonus + pop_bonus;
            matched = true;
        } else if region_low.contains(&q) {
            score = 100 + type_bonus + pop_bonus;
            matched = true;
        }

        if matched {
            scored.push((score, p));
        }
    }

    scored.sort_by(|a, b| b.0.cmp(&a.0));

    let results = scored.into_iter().take(50).map(|(_, p)| p.clone()).collect();
    Ok(results)
}

#[derive(Copy, Clone, PartialEq)]
struct RouteState {
    cost: f64,
    node: usize,
}

impl Eq for RouteState {}

impl Ord for RouteState {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        other.cost.partial_cmp(&self.cost).unwrap_or(std::cmp::Ordering::Equal)
    }
}

impl PartialOrd for RouteState {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

pub struct CachedGraph {
    pub nodes: Vec<[f64; 2]>,
    pub edges: Vec<GraphEdge>,
    pub adj: Vec<Vec<usize>>,
    pub spatial_grid: std::collections::HashMap<(i32, i32), Vec<usize>>,
}

static GRAPH_CACHE: std::sync::OnceLock<Result<CachedGraph, String>> = std::sync::OnceLock::new();

fn get_cached_graph(app: &tauri::AppHandle) -> Result<&'static CachedGraph, String> {
    GRAPH_CACHE.get_or_init(|| {
        let path = resolve_asset_path(app, "belarus_graph.json")?;
        let file = File::open(&path).map_err(|e| format!("Failed to open graph file: {}", e))?;
        let reader = std::io::BufReader::with_capacity(1024 * 1024, file);
        let raw_data: GraphData = serde_json::from_reader(reader)
            .map_err(|e| format!("Failed to parse graph JSON: {}", e))?;

        let mut nodes: Vec<[f64; 2]> = Vec::with_capacity(raw_data.nodes.len());
        for n in raw_data.nodes {
            nodes.push(n.coords);
        }

        let num_nodes = nodes.len();
        if num_nodes == 0 {
            return Err("Graph contains no nodes".to_string());
        }

        let mut edges = raw_data.edges;
        let original_edges_count = edges.len();
        edges.reserve(original_edges_count);
        for i in 0..original_edges_count {
            let e = &edges[i];
            if !e.oneWay && e.from != e.to {
                let rev_geom = e.geometry.as_ref().map(|g| {
                    let mut rg = g.clone();
                    rg.reverse();
                    rg
                });
                edges.push(GraphEdge {
                    from: e.to,
                    to: e.from,
                    fromPlace: e.toPlace.clone(),
                    toPlace: e.fromPlace.clone(),
                    distanceKm: e.distanceKm,
                    roadType: e.roadType.clone(),
                    speedKmh: e.speedKmh,
                    oneWay: false,
                    geometry: rev_geom,
                });
            }
        }

        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); num_nodes];
        for (idx, e) in edges.iter().enumerate() {
            if e.from < num_nodes && e.to < num_nodes {
                adj[e.from].push(idx);
            }
        }

        let cell_size = 0.05;
        let mut spatial_grid: std::collections::HashMap<(i32, i32), Vec<usize>> = std::collections::HashMap::with_capacity(10000);
        for (idx, &n_pt) in nodes.iter().enumerate() {
            let key = ((n_pt[0] / cell_size).floor() as i32, (n_pt[1] / cell_size).floor() as i32);
            spatial_grid.entry(key).or_default().push(idx);
        }

        Ok(CachedGraph {
            nodes,
            edges,
            adj,
            spatial_grid,
        })
    }).as_ref().map_err(|e| e.clone())
}

fn count_sharp_turns(coords: &[[f64; 2]]) -> usize {
    if coords.len() < 3 {
        return 0;
    }
    let mut count = 0;
    for i in 1..(coords.len() - 1) {
        let p0 = coords[i - 1];
        let p1 = coords[i];
        let p2 = coords[i + 1];
        let v1 = [p1[0] - p0[0], p1[1] - p0[1]];
        let v2 = [p2[0] - p1[0], p2[1] - p1[1]];
        let dot = v1[0] * v2[0] + v1[1] * v2[1];
        let mag1 = (v1[0] * v1[0] + v1[1] * v1[1]).sqrt();
        let mag2 = (v2[0] * v2[0] + v2[1] * v2[1]).sqrt();
        if mag1 > 0.0 && mag2 > 0.0 {
            let cos_angle = (dot / (mag1 * mag2)).clamp(-1.0, 1.0);
            let angle_deg = cos_angle.acos().to_degrees();
            if angle_deg >= 90.0 {
                count += 1;
            }
        }
    }
    count
}

fn calculate_march_route_sync(
    app: &tauri::AppHandle,
    origin: [f64; 2],
    destination: [f64; 2],
    waypoints: Option<Vec<[f64; 2]>>,
    column_type: Option<String>,
    is_night: Option<bool>,
) -> Result<RouteResult, String> {
    let graph = get_cached_graph(app)?;
    let nodes = &graph.nodes;
    let edges = &graph.edges;
    let adj = &graph.adj;
    let spatial_grid = &graph.spatial_grid;
    let is_night_march = is_night.unwrap_or(false);
    let col_type = column_type.unwrap_or_else(|| "wheel".to_string());
    let speed_multiplier = if is_night_march { 0.7 } else { 1.0 };

    let cell_size = 0.05;
    let find_nearest = |pt: [f64; 2]| -> usize {
        let cx = (pt[0] / cell_size).floor() as i32;
        let cy = (pt[1] / cell_size).floor() as i32;
        let mut min_d = f64::MAX;
        let mut best_idx = 0;

        for radius in 0..=3 {
            for dx in -radius..=radius {
                for dy in -radius..=radius {
                    if let Some(list) = spatial_grid.get(&(cx + dx, cy + dy)) {
                        for &idx in list {
                            let d = distance_between(pt, nodes[idx]);
                            if d < min_d {
                                min_d = d;
                                best_idx = idx;
                            }
                        }
                    }
                }
            }
            if min_d < f64::MAX {
                break;
            }
        }

        if min_d == f64::MAX {
            for (idx, &n_pt) in nodes.iter().enumerate() {
                let d = distance_between(pt, n_pt);
                if d < min_d {
                    min_d = d;
                    best_idx = idx;
                }
            }
        }
        best_idx
    };

    let mut points_to_visit = Vec::new();
    points_to_visit.push(origin);
    if let Some(wps) = waypoints {
        for wp in wps {
            points_to_visit.push(wp);
        }
    }
    points_to_visit.push(destination);

    let max_col_speed = match col_type.as_str() {
        "foot" => 4.5,
        "caterpillar" | "mixed" => if is_night_march { 25.0 * 0.7 } else { 25.0 },
        _ => if is_night_march { 40.0 * 0.7 } else { 40.0 },
    };

    let mut full_path_edges: Vec<(usize, usize, usize)> = Vec::new();

    for i in 0..(points_to_visit.len() - 1) {
        let start_node = find_nearest(points_to_visit[i]);
        let end_node = find_nearest(points_to_visit[i + 1]);

        if start_node == end_node {
            continue;
        }

        let target_pt = nodes[end_node];
        let mut dists = std::collections::HashMap::new();
        let mut prev = std::collections::HashMap::new();
        let mut open_set = std::collections::BinaryHeap::new();

        dists.insert(start_node, 0.0);
        open_set.push(RouteState {
            cost: distance_between(nodes[start_node], target_pt) / max_col_speed,
            node: start_node,
        });

        while let Some(RouteState { cost, node }) = open_set.pop() {
            if node == end_node {
                break;
            }

            let current_g = *dists.get(&node).unwrap_or(&f64::MAX);
            let current_h = distance_between(nodes[node], target_pt) / max_col_speed;
            if cost > current_g + current_h + 0.00001 {
                continue;
            }

            let prev_node = prev.get(&node).map(|&(p, _)| p);

            for &edge_idx in &adj[node] {
                let edge = &edges[edge_idx];
                let next = edge.to;

                if Some(next) == prev_node && adj[node].len() > 1 {
                    continue;
                }

                let speed = get_speed_for_type(&col_type, &edge.roadType, 60.0) * speed_multiplier;
                let edge_cost = edge.distanceKm / speed.max(1.0);
                let new_g = current_g + edge_cost;

                if new_g < *dists.get(&next).unwrap_or(&f64::MAX) {
                    dists.insert(next, new_g);
                    prev.insert(next, (node, edge_idx));
                    let h = distance_between(nodes[next], target_pt) / max_col_speed;
                    open_set.push(RouteState {
                        cost: new_g + h,
                        node: next,
                    });
                }
            }
        }

        let mut path = Vec::new();
        let mut curr = end_node;

        while curr != start_node {
            if let Some(&(p_node, edge_idx)) = prev.get(&curr) {
                path.push((p_node, curr, edge_idx));
                curr = p_node;
            } else {
                break;
            }
        }

        if curr == start_node {
            path.reverse();
            full_path_edges.extend(path);
        }
    }

    let mut coords: Vec<[f64; 2]> = Vec::new();
    coords.push(origin);

    let mut segments = Vec::new();
    let mut total_dist = 0.0;
    let mut total_duration = 0.0;

    for &(u, v, edge_idx) in &full_path_edges {
        let edge = &edges[edge_idx];
        let p1 = nodes[u];
        let p2 = nodes[v];

        if let Some(ref geom) = edge.geometry {
            if !geom.is_empty() {
                coords.extend_from_slice(&geom[1..]);
            } else {
                coords.push(p2);
            }
        } else {
            coords.push(p2);
        }

        let dist = edge.distanceKm;
        let road_type = &edge.roadType;
        let speed = get_speed_for_type(&col_type, road_type, 60.0) * speed_multiplier;
        let duration = dist / speed.max(1.0);

        total_dist += dist;
        total_duration += duration;

        segments.push(RouteSegmentResult {
            from: p1,
            to: p2,
            fromPlace: edge.fromPlace.clone().unwrap_or_default(),
            toPlace: edge.toPlace.clone().unwrap_or_default(),
            distanceKm: (dist * 100.0).round() / 100.0,
            roadType: road_type.clone(),
            speedKmH: (speed * 100.0).round() / 100.0,
            durationHrs: (duration * 100.0).round() / 100.0,
            geometry: edge.geometry.clone(),
        });
    }

    if segments.is_empty() {
        coords.clear();
        coords.push(origin);
        for i in 0..(points_to_visit.len() - 1) {
            let p1 = points_to_visit[i];
            let p2 = points_to_visit[i + 1];
            let dist = distance_between(p1, p2);
            let speed = get_speed_for_type(&col_type, "primary", 60.0) * speed_multiplier;
            let duration = dist / speed.max(1.0);
            total_dist += dist;
            total_duration += duration;
            coords.push(p2);
            segments.push(RouteSegmentResult {
                from: p1,
                to: p2,
                fromPlace: String::new(),
                toPlace: String::new(),
                distanceKm: (dist * 100.0).round() / 100.0,
                roadType: "primary".to_string(),
                speedKmH: (speed * 100.0).round() / 100.0,
                durationHrs: (duration * 100.0).round() / 100.0,
                geometry: Some(vec![p1, p2]),
            });
        }
    }

    if let Some(last) = coords.last() {
        if distance_between(*last, destination) > 0.001 {
            coords.push(destination);
        }
    }

    let sharp_turns = count_sharp_turns(&coords);
    let bridges = (total_dist / 45.0).floor() as usize;
    let barriers = (total_dist / 60.0).floor() as usize;

    Ok(RouteResult {
        coordinates: coords,
        segments,
        totalDistanceKm: (total_dist * 100.0).round() / 100.0,
        totalDurationHrs: (total_duration * 100.0).round() / 100.0,
        sharpTurnCount: sharp_turns,
        bridgeCount: bridges,
        totalBarriers: barriers,
    })
}

#[tauri::command]
async fn calculate_march_route(
    app: tauri::AppHandle,
    origin: [f64; 2],
    destination: [f64; 2],
    waypoints: Option<Vec<[f64; 2]>>,
    column_type: Option<String>,
    is_night: Option<bool>,
) -> Result<RouteResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        calculate_march_route_sync(&app, origin, destination, waypoints, column_type, is_night)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

fn geo_distance_m(p1: [f64; 2], p2: [f64; 2]) -> f64 {
    let r = 6371000.0;
    let d_lat = (p2[1] - p1[1]).to_radians();
    let d_lon = (p2[0] - p1[0]).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + p1[1].to_radians().cos() * p2[1].to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    r * c
}

fn destination_point_m(center: [f64; 2], dist_m: f64, bearing_deg: f64) -> [f64; 2] {
    let r = 6371000.0;
    let brng = bearing_deg.to_radians();
    let lat1 = center[1].to_radians();
    let lon1 = center[0].to_radians();
    let d = dist_m / r;

    let lat2 = (lat1.sin() * d.cos() + lat1.cos() * d.sin() * brng.cos()).asin();
    let lon2 = lon1 + (brng.sin() * d.sin() * lat1.cos()).atan2(d.cos() - lat1.sin() * lat2.sin());

    [lon2.to_degrees(), lat2.to_degrees()]
}

fn calculate_bearing_deg(p1: [f64; 2], p2: [f64; 2]) -> f64 {
    let lat1 = p1[1].to_radians();
    let lat2 = p2[1].to_radians();
    let d_lon = (p2[0] - p1[0]).to_radians();
    let y = d_lon.sin() * lat2.cos();
    let x = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * d_lon.cos();
    (y.atan2(x).to_degrees() + 360.0) % 360.0
}

fn lng_lat_to_dem_grid(lng: f64, lat: f64) -> (f64, f64) {
    let global_x = ((lng + 180.0) / 360.0) * 65536.0;
    let lat_rad = lat.clamp(-85.0, 85.0).to_radians();
    let n = (std::f64::consts::PI / 4.0 + lat_rad / 2.0).tan().ln();
    let global_y = (0.5 - n / (2.0 * std::f64::consts::PI)) * 65536.0;

    let gx = (global_x - 144.0 * 256.0) / 2.0;
    let gy = (global_y - 79.0 * 256.0) / 2.0;
    (gx, gy)
}

pub struct CachedDem {
    pub data: Vec<f32>,
    pub width: usize,
    pub height: usize,
}

impl CachedDem {
    pub fn get_elevation(&self, lng: f64, lat: f64) -> f64 {
        let (gx, gy) = lng_lat_to_dem_grid(lng, lat);
        if gx < 0.0 || gx >= (self.width - 1) as f64 || gy < 0.0 || gy >= (self.height - 1) as f64 {
            return 150.0;
        }
        let x0 = (gx.floor() as usize).min(self.width - 2);
        let y0 = (gy.floor() as usize).min(self.height - 2);
        let x1 = x0 + 1;
        let y1 = y0 + 1;

        let tx = (gx - x0 as f64).clamp(0.0, 1.0);
        let ty = (gy - y0 as f64).clamp(0.0, 1.0);

        let h00 = self.data[y0 * self.width + x0] as f64;
        let h10 = self.data[y0 * self.width + x1] as f64;
        let h01 = self.data[y1 * self.width + x0] as f64;
        let h11 = self.data[y1 * self.width + x1] as f64;

        let h0 = h00 * (1.0 - tx) + h10 * tx;
        let h1 = h01 * (1.0 - tx) + h11 * tx;
        h0 * (1.0 - ty) + h1 * ty
    }

    pub fn get_slope_bearing(&self, lng: f64, lat: f64) -> Option<f64> {
        let delta = 0.0005;
        let (gx, gy) = lng_lat_to_dem_grid(lng, lat);
        if gx < 2.0 || gx >= (self.width - 2) as f64 || gy < 2.0 || gy >= (self.height - 2) as f64 {
            return None;
        }

        let h_east = self.get_elevation(lng + delta, lat);
        let h_west = self.get_elevation(lng - delta, lat);
        let h_north = self.get_elevation(lng, lat + delta);
        let h_south = self.get_elevation(lng, lat - delta);

        let lat_rad = lat.to_radians();
        let cos_lat = lat_rad.cos();
        let dx_m = delta * 111320.0 * cos_lat;
        let dy_m = delta * 111132.0;

        let dz_dx = (h_east - h_west) / (2.0 * dx_m);
        let dz_dy = (h_north - h_south) / (2.0 * dy_m);

        let grad_len = (dz_dx * dz_dx + dz_dy * dz_dy).sqrt();
        if grad_len < 0.0001 {
            return None;
        }

        let downhill_x = -dz_dx;
        let downhill_y = -dz_dy;

        let bearing = downhill_x.atan2(downhill_y).to_degrees();
        Some(((bearing + 360.0) % 360.0).round())
    }
}

static DEM_CACHE: std::sync::OnceLock<Result<CachedDem, String>> = std::sync::OnceLock::new();

fn get_cached_dem(app: &tauri::AppHandle) -> Result<&'static CachedDem, String> {
    DEM_CACHE.get_or_init(|| {
        let path = resolve_asset_path(app, "belarus_dem.bin")?;
        let bytes = std::fs::read(&path)
            .map_err(|e| format!("Failed to read DEM file: {}", e))?;
        if bytes.len() < 1024 * 1024 * 4 {
            return Err(format!("DEM file size too small: {} bytes", bytes.len()));
        }
        let floats_count = 1024 * 1024;
        let mut data = Vec::with_capacity(floats_count);
        for chunk in bytes[0..(floats_count * 4)].chunks_exact(4) {
            let val = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            data.push(val);
        }
        Ok(CachedDem {
            data,
            width: 1024,
            height: 1024,
        })
    }).as_ref().map_err(|e| e.clone())
}

#[tauri::command]
fn get_elevation_at(app: tauri::AppHandle, coords: [f64; 2]) -> Result<f64, String> {
    let dem = get_cached_dem(&app)?;
    let val = dem.get_elevation(coords[0], coords[1]);
    Ok((val * 10.0).round() / 10.0)
}

#[tauri::command]
fn get_slope_bearing(app: tauri::AppHandle, coords: [f64; 2]) -> Result<Option<f64>, String> {
    let dem = get_cached_dem(&app)?;
    Ok(dem.get_slope_bearing(coords[0], coords[1]))
}

#[derive(serde::Serialize)]
pub struct ElevationProfilePoint {
    #[serde(rename = "distanceM")]
    pub distance_m: f64,
    #[serde(rename = "elevationM")]
    pub elevation_m: f64,
    #[serde(rename = "slopePercent")]
    pub slope_percent: f64,
    #[serde(rename = "slopeDegrees")]
    pub slope_degrees: f64,
    pub coord: [f64; 2],
}

#[derive(serde::Serialize)]
pub struct ElevationProfileResult {
    pub points: Vec<ElevationProfilePoint>,
    #[serde(rename = "totalDistanceM")]
    pub total_distance_m: f64,
    #[serde(rename = "minElevation")]
    pub min_elevation: f64,
    #[serde(rename = "maxElevation")]
    pub max_elevation: f64,
    #[serde(rename = "elevationGainM")]
    pub elevation_gain_m: f64,
    #[serde(rename = "elevationLossM")]
    pub elevation_loss_m: f64,
    #[serde(rename = "maxSlopePercent")]
    pub max_slope_percent: f64,
}

#[tauri::command]
fn get_elevation_profile(
    app: tauri::AppHandle,
    coordinates: Vec<[f64; 2]>,
    step_m: Option<f64>,
) -> Result<ElevationProfileResult, String> {
    if coordinates.len() < 2 {
        return Ok(ElevationProfileResult {
            points: Vec::new(),
            total_distance_m: 0.0,
            min_elevation: 0.0,
            max_elevation: 0.0,
            elevation_gain_m: 0.0,
            elevation_loss_m: 0.0,
            max_slope_percent: 0.0,
        });
    }

    let dem = get_cached_dem(&app)?;
    let step = step_m.unwrap_or(25.0).max(5.0);

    let mut points = Vec::new();
    let mut acc_dist = 0.0;
    let mut gain = 0.0;
    let mut loss = 0.0;
    let mut min_e = f64::INFINITY;
    let mut max_e = -f64::INFINITY;
    let mut max_slope: f64 = 0.0;

    let mut last_pt: Option<[f64; 2]> = None;
    let mut last_elev: Option<f64> = None;
    let mut last_acc_dist = 0.0;

    for i in 0..(coordinates.len() - 1) {
        let p1 = coordinates[i];
        let p2 = coordinates[i + 1];
        let seg_dist = geo_distance_m(p1, p2);
        let steps = ((seg_dist / step).ceil() as usize).max(1);

        for s in 0..steps {
            let t = (s as f64) / (steps as f64);
            let lng = p1[0] + (p2[0] - p1[0]) * t;
            let lat = p1[1] + (p2[1] - p1[1]) * t;
            let pt = [lng, lat];

            if let Some(lp) = last_pt {
                acc_dist += geo_distance_m(lp, pt);
            }

            let raw_elev = dem.get_elevation(lng, lat);
            let elev = (raw_elev * 10.0).round() / 10.0;

            let mut slope_p = 0.0;
            let mut slope_deg = 0.0;

            if let Some(le) = last_elev {
                let delta_h = elev - le;
                let delta_d = (acc_dist - last_acc_dist).max(0.1);
                slope_p = (delta_h / delta_d) * 100.0;
                slope_deg = delta_h.atan2(delta_d).to_degrees();

                if delta_h > 0.0 { gain += delta_h; }
                if delta_h < 0.0 { loss += delta_h.abs(); }

                if slope_p.abs() > max_slope.abs() {
                    max_slope = slope_p;
                }
            }

            if elev < min_e { min_e = elev; }
            if elev > max_e { max_e = elev; }

            points.push(ElevationProfilePoint {
                distance_m: (acc_dist * 10.0).round() / 10.0,
                elevation_m: elev,
                slope_percent: (slope_p * 10.0).round() / 10.0,
                slope_degrees: (slope_deg * 10.0).round() / 10.0,
                coord: pt,
            });

            last_pt = Some(pt);
            last_elev = Some(elev);
            last_acc_dist = acc_dist;
        }
    }

    if let Some(last_coord) = coordinates.last() {
        let raw_elev = dem.get_elevation(last_coord[0], last_coord[1]);
        let elev = (raw_elev * 10.0).round() / 10.0;
        if let Some(lp) = last_pt {
            acc_dist += geo_distance_m(lp, *last_coord);
        }
        if elev < min_e { min_e = elev; }
        if elev > max_e { max_e = elev; }

        points.push(ElevationProfilePoint {
            distance_m: (acc_dist * 10.0).round() / 10.0,
            elevation_m: elev,
            slope_percent: 0.0,
            slope_degrees: 0.0,
            coord: *last_coord,
        });
    }

    Ok(ElevationProfileResult {
        points,
        total_distance_m: (acc_dist * 10.0).round() / 10.0,
        min_elevation: if min_e == f64::INFINITY { 0.0 } else { min_e },
        max_elevation: if max_e == -f64::INFINITY { 0.0 } else { max_e },
        elevation_gain_m: gain.round(),
        elevation_loss_m: loss.round(),
        max_slope_percent: (max_slope * 10.0).round() / 10.0,
    })
}

#[tauri::command]
fn calculate_viewshed(
    app: tauri::AppHandle,
    center: [f64; 2],
    observer_height_m: Option<f64>,
    target_height_m: Option<f64>,
    max_radius_m: Option<f64>,
    num_rays: Option<usize>,
    steps_per_ray: Option<usize>,
) -> Result<serde_json::Value, String> {
    use rayon::prelude::*;

    let dem = get_cached_dem(&app)?;
    let obs_h = observer_height_m.unwrap_or(1.8).max(0.1);
    let target_h = target_height_m.unwrap_or(2.0).max(0.0);
    let max_radius = max_radius_m.unwrap_or(3000.0).clamp(100.0, 50000.0);
    let rays_count = num_rays.unwrap_or(180).clamp(36, 360);
    let steps_count = steps_per_ray.unwrap_or(30).clamp(10, 60);

    let base_elev = dem.get_elevation(center[0], center[1]);
    let obs_total = base_elev + obs_h;
    let angle_step = 360.0 / (rays_count as f64);
    let earth_radius = 6371000.0;

    let ray_indices: Vec<usize> = (0..rays_count).collect();

    let ray_features: Vec<Vec<serde_json::Value>> = ray_indices.par_iter().map(|&r| {
        let angle1 = (r as f64) * angle_step;
        let angle2 = ((r + 1) as f64) * angle_step;
        let mid_angle = (angle1 + angle2) / 2.0;

        let mut max_slope = -f64::INFINITY;
        let mut features = Vec::new();

        let mut current_status: Option<bool> = None;
        let mut block_start_dist = 0.0;

        for s in 1..=steps_count {
            let d1 = ((s - 1) as f64 / steps_count as f64) * max_radius;
            let d2 = (s as f64 / steps_count as f64) * max_radius;

            let pt_mid = destination_point_m(center, d2, mid_angle);
            let pt_elev = dem.get_elevation(pt_mid[0], pt_mid[1]);

            let earth_drop = (d2 * d2) / (2.0 * earth_radius);
            let target_total = pt_elev + target_h - earth_drop;

            let slope = (target_total - obs_total) / d2.max(1.0);
            let is_visible = slope >= max_slope;

            if slope > max_slope {
                max_slope = slope;
            }

            match current_status {
                Some(status) if status == is_visible => {}
                Some(status) => {
                    let p1 = if block_start_dist == 0.0 { center } else { destination_point_m(center, block_start_dist, angle1) };
                    let p2 = destination_point_m(center, d1, angle1);
                    let p3 = destination_point_m(center, d1, angle2);
                    let p4 = if block_start_dist == 0.0 { center } else { destination_point_m(center, block_start_dist, angle2) };

                    let status_str = if status { "visible" } else { "hidden" };
                    features.push(serde_json::json!({
                        "type": "Feature",
                        "properties": { "status": status_str },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [p1[0], p1[1]],
                                [p2[0], p2[1]],
                                [p3[0], p3[1]],
                                [p4[0], p4[1]],
                                [p1[0], p1[1]]
                            ]]
                        }
                    }));
                    current_status = Some(is_visible);
                    block_start_dist = d1;
                }
                None => {
                    current_status = Some(is_visible);
                    block_start_dist = d1;
                }
            }
        }

        if let Some(status) = current_status {
            let p1 = if block_start_dist == 0.0 { center } else { destination_point_m(center, block_start_dist, angle1) };
            let p2 = destination_point_m(center, max_radius, angle1);
            let p3 = destination_point_m(center, max_radius, angle2);
            let p4 = if block_start_dist == 0.0 { center } else { destination_point_m(center, block_start_dist, angle2) };

            let status_str = if status { "visible" } else { "hidden" };
            features.push(serde_json::json!({
                "type": "Feature",
                "properties": { "status": status_str },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [p1[0], p1[1]],
                        [p2[0], p2[1]],
                        [p3[0], p3[1]],
                        [p4[0], p4[1]],
                        [p1[0], p1[1]]
                    ]]
                }
            }));
        }

        features
    }).collect();

    let flattened_features: Vec<serde_json::Value> = ray_features.into_iter().flatten().collect();

    Ok(serde_json::json!({
        "type": "FeatureCollection",
        "features": flattened_features
    }))
}

#[derive(Clone, Debug)]
pub struct PlaceSpatialItem {
    pub place: PlaceInfo,
    pub point: [f64; 2],
}

impl rstar::RTreeObject for PlaceSpatialItem {
    type Envelope = rstar::AABB<[f64; 2]>;
    fn envelope(&self) -> Self::Envelope {
        rstar::AABB::from_point(self.point)
    }
}

impl rstar::PointDistance for PlaceSpatialItem {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        let dx = self.point[0] - point[0];
        let dy = self.point[1] - point[1];
        dx * dx + dy * dy
    }
}

pub struct CachedPlacesTree {
    pub tree: rstar::RTree<PlaceSpatialItem>,
    pub places: Vec<PlaceInfo>,
}

static PLACES_TREE_CACHE: std::sync::OnceLock<Result<CachedPlacesTree, String>> = std::sync::OnceLock::new();

fn get_cached_places_tree(app: &tauri::AppHandle) -> Result<&'static CachedPlacesTree, String> {
    PLACES_TREE_CACHE.get_or_init(|| {
        let path = resolve_asset_path(app, "belarus_places.json")?;
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read places: {}", e))?;
        let raw_places: Vec<PlaceInfo> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse places JSON: {}", e))?;

        let mut items = Vec::with_capacity(raw_places.len());
        for p in &raw_places {
            if p.coords[0] != 0.0 || p.coords[1] != 0.0 {
                items.push(PlaceSpatialItem {
                    place: p.clone(),
                    point: p.coords,
                });
            }
        }

        let tree = rstar::RTree::bulk_load(items);
        Ok(CachedPlacesTree {
            tree,
            places: raw_places,
        })
    }).as_ref().map_err(|e| e.clone())
}

#[derive(serde::Serialize, Clone)]
pub struct MarchPlaceItem {
    pub id: String,
    pub name: String,
    pub nameBe: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub region: String,
    pub coords: [f64; 2],
    #[serde(rename = "distanceAlongRouteKm")]
    pub distance_along_route_km: f64,
    #[serde(rename = "distanceFromRouteKm")]
    pub distance_from_route_km: f64,
    #[serde(rename = "textAnchor")]
    pub text_anchor: String,
    #[serde(rename = "textOffset")]
    pub text_offset: [f64; 2],
    #[serde(rename = "svgAnchor")]
    pub svg_anchor: String,
    #[serde(rename = "svgOffset")]
    pub svg_offset: [f64; 2],
    #[serde(rename = "svgBaseline")]
    pub svg_baseline: String,
}

#[derive(serde::Serialize)]
pub struct MarchKilometerMark {
    pub km: usize,
    pub label: String,
    pub coords: [f64; 2],
    pub bearing: f64,
}

#[derive(serde::Serialize)]
pub struct MarchOverlaysResult {
    pub places: Vec<MarchPlaceItem>,
    #[serde(rename = "kilometerMarks")]
    pub kilometer_marks: Vec<MarchKilometerMark>,
}

fn project_point_on_segment_m(p: [f64; 2], a: [f64; 2], b: [f64; 2]) -> ([f64; 2], f64, f64) {
    let lat_mid = ((a[1] + b[1]) / 2.0).to_radians();
    let cos_lat = lat_mid.cos();

    let ax = a[0] * cos_lat;
    let ay = a[1];
    let bx = b[0] * cos_lat;
    let by = b[1];
    let px = p[0] * cos_lat;
    let py = p[1];

    let dx = bx - ax;
    let dy = by - ay;
    let len_sq = dx * dx + dy * dy;

    if len_sq == 0.0 {
        return (a, 0.0, geo_distance_m(p, a));
    }

    let t = (((px - ax) * dx + (py - ay) * dy) / len_sq).clamp(0.0, 1.0);
    let proj = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    let dist_m = geo_distance_m(p, proj);
    (proj, t, dist_m)
}

#[tauri::command]
fn get_march_overlays(
    app: tauri::AppHandle,
    coordinates: Vec<[f64; 2]>,
    corridor_km: Option<f64>,
    km_step: Option<f64>,
    show_places: Option<bool>,
) -> Result<MarchOverlaysResult, String> {
    if coordinates.len() < 2 {
        return Ok(MarchOverlaysResult {
            places: Vec::new(),
            kilometer_marks: Vec::new(),
        });
    }

    let mut cum_dist_km = vec![0.0];
    for i in 1..coordinates.len() {
        let seg_km = geo_distance_m(coordinates[i - 1], coordinates[i]) / 1000.0;
        cum_dist_km.push(cum_dist_km[i - 1] + seg_km);
    }
    let total_dist_km = *cum_dist_km.last().unwrap_or(&0.0);

    let step_val = km_step.unwrap_or(10.0);
    let mut km_marks = Vec::new();

    if step_val > 0.0 && total_dist_km > 0.0 {
        km_marks.push(MarchKilometerMark {
            km: 0,
            label: "0 км".to_string(),
            coords: coordinates[0],
            bearing: calculate_bearing_deg(coordinates[0], coordinates[1]),
        });

        let mut target_d = step_val;
        while target_d < total_dist_km {
            if total_dist_km - target_d < step_val * 0.3 {
                break;
            }

            let mut seg_idx = 0;
            while seg_idx < cum_dist_km.len() - 2 && cum_dist_km[seg_idx + 1] < target_d {
                seg_idx += 1;
            }

            let s_start = cum_dist_km[seg_idx];
            let s_end = cum_dist_km[seg_idx + 1];
            let s_len = s_end - s_start;

            if s_len > 0.0 {
                let t = ((target_d - s_start) / s_len).clamp(0.0, 1.0);
                let p1 = coordinates[seg_idx];
                let p2 = coordinates[seg_idx + 1];
                let lng = p1[0] + t * (p2[0] - p1[0]);
                let lat = p1[1] + t * (p2[1] - p1[1]);
                let km_int = target_d.round() as usize;

                km_marks.push(MarchKilometerMark {
                    km: km_int,
                    label: format!("{} км", km_int),
                    coords: [lng, lat],
                    bearing: calculate_bearing_deg(p1, p2),
                });
            }

            target_d += step_val;
        }

        if total_dist_km > 0.05 {
            let final_km = total_dist_km.round() as usize;
            let last_idx = coordinates.len() - 1;
            km_marks.push(MarchKilometerMark {
                km: final_km,
                label: format!("{} км", final_km),
                coords: coordinates[last_idx],
                bearing: calculate_bearing_deg(coordinates[last_idx - 1], coordinates[last_idx]),
            });
        }
    }

    if !show_places.unwrap_or(true) {
        return Ok(MarchOverlaysResult {
            places: Vec::new(),
            kilometer_marks: km_marks,
        });
    }

    let places_data = get_cached_places_tree(&app)?;
    let corridor = corridor_km.unwrap_or(4.5).max(1.0);

    let mut min_lng = f64::INFINITY;
    let mut max_lng = -f64::INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lat = -f64::INFINITY;
    for c in &coordinates {
        if c[0] < min_lng { min_lng = c[0]; }
        if c[0] > max_lng { max_lng = c[0]; }
        if c[1] < min_lat { min_lat = c[1]; }
        if c[1] > max_lat { max_lat = c[1]; }
    }
    let pad = (corridor / 111.0) * 1.5;
    let aabb = rstar::AABB::from_corners([min_lng - pad, min_lat - pad], [max_lng + pad, max_lat + pad]);

    let candidates: Vec<&PlaceSpatialItem> = places_data.tree.locate_in_envelope_intersecting(&aabb).collect();

    let mut projected = Vec::new();

    for item in candidates {
        let place = &item.place;
        let mut min_dist_m = f64::INFINITY;
        let mut best_dist_along_km = 0.0;
        let mut best_proj = [0.0, 0.0];
        let mut best_p1 = [0.0, 0.0];
        let mut best_p2 = [0.0, 0.0];

        for i in 0..(coordinates.len() - 1) {
            let p1 = coordinates[i];
            let p2 = coordinates[i + 1];
            let (proj, t, d_m) = project_point_on_segment_m(place.coords, p1, p2);
            if d_m < min_dist_m {
                min_dist_m = d_m;
                let seg_len_km = cum_dist_km[i + 1] - cum_dist_km[i];
                best_dist_along_km = cum_dist_km[i] + t * seg_len_km;
                best_proj = proj;
                best_p1 = p1;
                best_p2 = p2;
            }
        }

        let dist_km = min_dist_m / 1000.0;
        let place_type = place.type_.to_lowercase();
        let max_allowed_km = match place_type.as_str() {
            "city" => 12.0,
            "town" => 8.5,
            "settlement" | "suburb" => 4.5,
            _ => 2.5,
        };

        if dist_km <= max_allowed_km {
            let lat_mid = ((best_p1[1] + best_p2[1]) / 2.0).to_radians();
            let cos_lat = lat_mid.cos();
            let mut d_x = (place.coords[0] - best_proj[0]) * cos_lat;
            let mut d_y = place.coords[1] - best_proj[1];

            if d_x.hypot(d_y) < 1e-6 {
                let seg_dx = (best_p2[0] - best_p1[0]) * cos_lat;
                let seg_dy = best_p2[1] - best_p1[1];
                let seg_len = seg_dx.hypot(seg_dy).max(1e-6);
                d_x = -seg_dy / seg_len;
                d_y = seg_dx / seg_len;
            }

            let (text_anchor, text_offset, svg_anchor, svg_offset, svg_baseline) = if d_x.abs() >= d_y.abs() {
                if d_x >= 0.0 {
                    ("left".to_string(), [0.85, 0.0], "start".to_string(), [10.0, 0.0], "central".to_string())
                } else {
                    ("right".to_string(), [-0.85, 0.0], "end".to_string(), [-10.0, 0.0], "central".to_string())
                }
            } else {
                if d_y >= 0.0 {
                    ("bottom".to_string(), [0.0, -0.85], "middle".to_string(), [0.0, -10.0], "auto".to_string())
                } else {
                    ("top".to_string(), [0.0, 0.85], "middle".to_string(), [0.0, 10.0], "hanging".to_string())
                }
            };

            projected.push(MarchPlaceItem {
                id: place.id.clone(),
                name: place.name.clone(),
                nameBe: place.nameBe.clone(),
                type_: place.type_.clone(),
                region: place.region.clone(),
                coords: place.coords,
                distance_along_route_km: (best_dist_along_km * 100.0).round() / 100.0,
                distance_from_route_km: (dist_km * 100.0).round() / 100.0,
                text_anchor,
                text_offset,
                svg_anchor,
                svg_offset,
                svg_baseline,
            });
        }
    }

    projected.sort_by(|a, b| a.distance_along_route_km.partial_cmp(&b.distance_along_route_km).unwrap());

    let mut filtered_places: Vec<MarchPlaceItem> = Vec::new();
    for p in projected {
        let is_dup = filtered_places.iter().any(|existing| {
            (existing.distance_along_route_km - p.distance_along_route_km).abs() < 2.5
                && existing.name.to_lowercase() == p.name.to_lowercase()
        });
        if !is_dup {
            filtered_places.push(p);
        }
    }

    Ok(MarchOverlaysResult {
        places: filtered_places,
        kilometer_marks: km_marks,
    })
}


#[tauri::command]
fn read_pmtiles_chunk(app: tauri::AppHandle, filename: String, offset: u64, length: usize) -> Result<Vec<u8>, String> {
    use std::fs::File;
    use std::io::{Read, Seek, SeekFrom};
    use tauri::Manager;

    let mut file_path = std::path::PathBuf::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        let path1 = resource_dir.join("assets").join(&filename);
        if path1.exists() { file_path = path1; }
        else {
            let path2 = resource_dir.join(&filename);
            if path2.exists() { file_path = path2; }
        }
    }

    if file_path.as_os_str().is_empty() {
        let current_dir = std::env::current_dir().expect("Failed to get current dir");
        let base_dir = if current_dir.ends_with("src-tauri") {
            current_dir.parent().unwrap().to_path_buf()
        } else {
            current_dir.clone()
        };

        let path1 = base_dir.join("assets").join(&filename);
        if path1.exists() { file_path = path1; }
        
        let path2 = base_dir.join("src-tauri").join("assets").join(&filename);
        if path2.exists() { file_path = path2; }
    }

    if file_path.as_os_str().is_empty() || !file_path.exists() {
        return Err(format!("PMTiles file '{}' not found", filename));
    }

    let mut file = File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let file_len = file.metadata()
        .map(|m| m.len())
        .unwrap_or(0);

    if offset >= file_len {
        return Ok(Vec::new());
    }

    let read_len = std::cmp::min(length as u64, file_len - offset) as usize;
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| format!("Seek error: {}", e))?;

    let mut buffer = vec![0; read_len];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Read error: {}", e))?;

    Ok(buffer)
}

#[tauri::command]
fn choose_save_path(default_name: Option<String>, extension: Option<String>, title: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = &title {
        dialog = dialog.set_title(t);
    }
    if let Some(name) = &default_name {
        dialog = dialog.set_file_name(name);
    }
    if let Some(ext) = &extension {
        dialog = dialog.add_filter(ext, &[ext]);
    }
    let res = dialog.save_file();
    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn choose_open_path(extension: Option<String>, title: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = &title {
        dialog = dialog.set_title(t);
    }
    if let Some(ext) = &extension {
        dialog = dialog.add_filter(ext, &[ext]);
    }
    let res = dialog.pick_file();
    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn choose_directory(title: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = &title {
        dialog = dialog.set_title(t);
    }
    let res = dialog.pick_folder();
    Ok(res.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_scenario_to_path(target_path: String, content: Vec<u8>) -> Result<String, String> {
    use std::fs::File;
    use std::io::Write;
    let mut file = File::create(&target_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&content)
        .map_err(|e| format!("Failed to write content: {}", e))?;
    Ok(target_path)
}

#[tauri::command]
fn read_file_content(file_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::Read;
    let mut file = File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let mut text = String::new();
    file.read_to_string(&mut text)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(text)
}

#[tauri::command]
fn save_scenario_file(app: tauri::AppHandle, filename: String, content: Vec<u8>) -> Result<String, String> {
    use std::fs::File;
    use std::io::Write;
    use tauri::Manager;

    let download_dir = app.path().download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?;
    
    let file_path = download_dir.join(&filename);
    
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(&content)
        .map_err(|e| format!("Failed to write content: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[derive(serde::Deserialize)]
struct MapExportParams {
    center: [f64; 2],
    zoom: f64,
    bearing: f64,
    pitch: f64,
    width_mm: u32,
    height_mm: u32,
    dpi: u32,
    scale: u32,
    logical_width: u32,
    logical_height: u32,
    ratio: f64,
    filename: String,
}

fn clean_unc_path(path: &std::path::Path) -> std::path::PathBuf {
    let path_str = path.to_string_lossy();
    if path_str.starts_with(r"\\?\") {
        std::path::PathBuf::from(&path_str[4..])
    } else {
        path.to_path_buf()
    }
}

#[tauri::command]
async fn export_map_native(
    app: tauri::AppHandle,
    params: MapExportParams,
    style_json: String,
    geojson_data: String,
    images_json: String,
) -> Result<String, String> {
    log::info!(
        "export_map_native invoked center=[{:?}, {:?}], zoom={}, dpi={}, scale={}, size={}x{}mm, filename={}",
        params.center[0],
        params.center[1],
        params.zoom,
        params.dpi,
        params.scale,
        params.width_mm,
        params.height_mm,
        params.filename
    );

    let mut style: serde_json::Value = serde_json::from_str(&style_json)
        .map_err(|e| format!("Failed to parse style JSON: {}", e))?;

    if !geojson_data.is_empty() && geojson_data != "{}" {
        if let Ok(geojson) = serde_json::from_str::<serde_json::Value>(&geojson_data) {
            if let Some(sources) = style.get_mut("sources") {
                if let Some(sources_obj) = sources.as_object_mut() {
                    sources_obj.insert(
                         "tactical-symbols".to_string(),
                        serde_json::json!({
                            "type": "geojson",
                            "data": geojson
                        })
                    );
                }
            }
        }
    }

    if let Some(sources) = style.get_mut("sources") {
        if let Some(sources_obj) = sources.as_object_mut() {
            for (_key, source) in sources_obj.iter_mut() {
                if source.get("type").and_then(|t| t.as_str()) == Some("geojson") {
                    let needs_fix = match source.get("data") {
                        Some(data) => data.get("type").is_none(),
                        None => true,
                    };
                    if needs_fix {
                        source["data"] = serde_json::json!({
                            "type": "FeatureCollection",
                            "features": []
                        });
                    }
                }
            }
        }
    }

    let resource_dir = clean_unc_path(&app.path().resource_dir().map_err(|e| e.to_string())?);

    let current_dir = clean_unc_path(&std::env::current_dir().map_err(|e| e.to_string())?);
    let base_dir = if current_dir.ends_with("src-tauri") {
        clean_unc_path(&current_dir.parent().unwrap().to_path_buf())
    } else {
        current_dir.clone()
    };

    let dev_script_path = clean_unc_path(&base_dir.join("src-tauri").join("sidecar-renderer").join("index.js"));
    let mut script_path = dev_script_path.clone();
    let mut pmtiles_dir = clean_unc_path(&base_dir.join("src-tauri").join("assets"));
    let mut is_dev = true;

    if !dev_script_path.exists() {
        is_dev = false;
        script_path = clean_unc_path(&resource_dir.join("sidecar-renderer").join("index.js"));
        pmtiles_dir = clean_unc_path(&resource_dir.join("assets"));
    }

    if !script_path.exists() {
        return Err(format!("Renderer script not found at {:?}", script_path));
    }

    let download_dir = clean_unc_path(&app.path().download_dir()
        .map_err(|e| format!("Failed to get download dir: {}", e))?);
    let output_path = clean_unc_path(&download_dir.join(&params.filename));

    let belarus_pmtiles_path = clean_unc_path(&pmtiles_dir.join("belarus.pmtiles"));
    let topomap_pmtiles_path = clean_unc_path(&pmtiles_dir.join("belarus_topomap_200k.pmtiles"));

    let normalized_bearing = ((params.bearing % 360.0) + 360.0) % 360.0;
    let clamped_pitch = params.pitch.clamp(0.0, 60.0);

    let mut config = serde_json::json!({
        "zoom": params.zoom,
        "width": params.logical_width,
        "height": params.logical_height,
        "center": params.center,
        "bearing": normalized_bearing,
        "pitch": clamped_pitch,
        "style": style,
        "ratio": params.ratio,
        "outputPath": output_path.to_string_lossy().to_string(),
        "belarusPmtilesPath": belarus_pmtiles_path.to_string_lossy().to_string(),
        "topomapPmtilesPath": topomap_pmtiles_path.to_string_lossy().to_string(),
        "resourceDir": resource_dir.to_string_lossy().to_string(),
        "baseDir": base_dir.to_string_lossy().to_string(),
        "isDev": is_dev
    });

    if !images_json.is_empty() && images_json != "{}" {
        if let Ok(images) = serde_json::from_str::<serde_json::Value>(&images_json) {
            if let Some(config_obj) = config.as_object_mut() {
                config_obj.insert("images".to_string(), images);
            }
        }
    }

    let config_str = serde_json::to_string(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    let run_res = run_node_renderer(Some(&app), &script_path, &config_str, &output_path);
    run_res.map(|_| output_path.to_string_lossy().to_string())
}

fn run_node_renderer(
    app: Option<&tauri::AppHandle>,
    script_path: &std::path::Path,
    config_str: &str,
    output_path: &std::path::Path,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader, Write};
    use std::process::{Command, Stdio};
    use tauri::Emitter;

    let script_dir = script_path.parent().ok_or_else(|| "Failed to get script parent directory".to_string())?;

    #[cfg(target_os = "windows")]
    let mut command = {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("node");
        cmd.creation_flags(0x08000000);
        cmd.current_dir(script_dir);
        cmd
    };

    #[cfg(not(target_os = "windows"))]
    let mut command = {
        let mut cmd = Command::new("node");
        cmd.current_dir(script_dir);
        cmd
    };

    let mut child = command
        .arg(script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Node renderer: {}", e))?;

    let stdout_stream = child.stdout.take().ok_or_else(|| "Failed to open stdout".to_string())?;
    let app_handle_clone = app.cloned();

    let stdout_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout_stream);
        let mut final_stdout = String::new();
        for line in reader.lines().flatten() {
            if line.contains("\"type\":\"progress\"") || line.contains("\"type\": \"progress\"") {
                if let Some(ref handle) = app_handle_clone {
                    let _ = handle.emit("export-progress", &line);
                }
            }
            final_stdout.push_str(&line);
            final_stdout.push('\n');
        }
        final_stdout
    });

    let write_result = if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(config_str.as_bytes())
    } else {
        Err(std::io::Error::new(std::io::ErrorKind::Other, "Failed to open stdin"))
    };

    if let Err(write_err) = write_result {
        match child.wait_with_output() {
            Ok(output) => {
                let err_msg = String::from_utf8_lossy(&output.stderr).into_owned();
                return Err(format!(
                    "Failed to write to stdin (process exited). Stderr: {}. Write error: {}",
                    err_msg.trim(),
                    write_err
                ));
            }
            Err(wait_err) => {
                return Err(format!(
                    "Failed to write to stdin: {}. Also failed to wait for process: {}",
                    write_err,
                    wait_err
                ));
            }
        }
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("Failed to wait for Node process: {}", e))?;

    let stdout_str = stdout_thread.join().unwrap_or_default();
    let stderr_str = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        let err_msg = if !stderr_str.trim().is_empty() { stderr_str } else { String::from_utf8_lossy(&output.stderr).to_string() };
        return Err(format!("Node renderer error: {}", err_msg));
    }

    if !stderr_str.trim().is_empty() {
        log::info!("Node renderer stderr:\n{}", stderr_str);
    }
    log::info!("Node renderer stdout: {}", stdout_str);

    if let Ok(result_val) = serde_json::from_str::<serde_json::Value>(&stdout_str) {
        if let Some(success) = result_val.get("success").and_then(|v| v.as_bool()) {
            if success {
                return Ok(());
            }
        }
        if let Some(error_msg) = result_val.get("error").and_then(|v| v.as_str()) {
            return Err(format!("Render failed: {}", error_msg));
        }
    }

    if output_path.exists() {
        Ok(())
    } else {
        Err(format!("Render process finished but output file not found. Stdout: {}", stdout_str))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_renderer_basic() {
        let script_path = std::path::Path::new("F:\\Vanya\\topos\\src-tauri\\sidecar-renderer\\index.js");
        let temp_dir = std::env::temp_dir();
        let output_path = temp_dir.join("test_output.png");

        let belarus_pmtiles = "F:\\Vanya\\topos\\src-tauri\\assets\\belarus.pmtiles";
        let topomap_pmtiles = "F:\\Vanya\\topos\\src-tauri\\assets\\belarus_topomap_200k.pmtiles";

        let config = serde_json::json!({
            "zoom": 6.5,
            "width": 200,
            "height": 200,
            "center": [27.5618, 53.9022],
            "bearing": 0.0,
            "pitch": 0.0,
            "style": {
                "version": 8,
                "sources": {
                    "belarus-data": {
                        "type": "vector",
                        "url": "pmtiles://http://topos.localhost/belarus.pmtiles"
                    }
                },
                "layers": [
                    {
                        "id": "background",
                        "type": "background",
                        "paint": {
                            "background-color": "#f0f0f0"
                        }
                    }
                ]
            },
            "ratio": 1.0,
            "outputPath": output_path.to_string_lossy().to_string(),
            "belarusPmtilesPath": belarus_pmtiles,
            "topomapPmtilesPath": topomap_pmtiles
        });

        let config_str = serde_json::to_string(&config).unwrap();
        let result = run_node_renderer(None, &script_path, &config_str, &output_path);
        println!("Test run result: {:?}", result);
        
        if output_path.exists() {
            let _ = std::fs::remove_file(output_path);
        }

        assert!(result.is_ok(), "Renderer test failed: {:?}", result.err());
    }

    #[test]
    fn test_geo_distance_and_destination() {
        let p1 = [27.5618, 53.9022];
        let p2 = [27.5618, 53.9112];
        let dist = geo_distance_m(p1, p2);
        assert!(dist > 900.0 && dist < 1100.0);

        let dest = destination_point_m(p1, 1000.0, 0.0);
        let dist_calc = geo_distance_m(p1, dest);
        assert!((dist_calc - 1000.0).abs() < 1.0);

        let bearing = calculate_bearing_deg(p1, dest);
        assert!((bearing - 0.0).abs() < 1.0 || (bearing - 360.0).abs() < 1.0);
    }

    #[test]
    fn test_cached_dem_interpolation() {
        let mut data = vec![100.0f32; 1024 * 1024];
        data[368 * 1024 + 460] = 200.0;
        data[368 * 1024 + 461] = 220.0;
        data[369 * 1024 + 460] = 240.0;
        data[369 * 1024 + 461] = 260.0;

        let dem = CachedDem {
            data,
            width: 1024,
            height: 1024,
        };

        let elev_edge = dem.get_elevation(10.0, 10.0);
        assert_eq!(elev_edge, 150.0);

        let p_minsk = [27.5618, 53.9022];
        let elev_minsk = dem.get_elevation(p_minsk[0], p_minsk[1]);
        assert!(elev_minsk >= 100.0);
    }

    #[test]
    fn test_project_point_on_segment() {
        let a = [27.0, 53.0];
        let b = [28.0, 53.0];
        let p = [27.5, 53.01];

        let (proj, t, dist_m) = project_point_on_segment_m(p, a, b);
        assert!((t - 0.5).abs() < 0.05);
        assert!((proj[0] - 27.5).abs() < 0.05);
        assert!((proj[1] - 53.0).abs() < 0.001);
        assert!(dist_m > 900.0 && dist_m < 1300.0);
    }

    #[test]
    fn test_places_spatial_tree() {
        let p1 = PlaceInfo {
            id: "p1".to_string(),
            name: "Minsk".to_string(),
            nameBe: "Мінск".to_string(),
            type_: "city".to_string(),
            region: "Minsk".to_string(),
            coords: [27.5618, 53.9022],
            population: Some(2000000),
            nodeId: Some(1),
        };
        let p2 = PlaceInfo {
            id: "p2".to_string(),
            name: "Brest".to_string(),
            nameBe: "Брэст".to_string(),
            type_: "city".to_string(),
            region: "Brest".to_string(),
            coords: [23.6847, 52.0976],
            population: Some(340000),
            nodeId: Some(2),
        };

        let items = vec![
            PlaceSpatialItem { place: p1.clone(), point: p1.coords },
            PlaceSpatialItem { place: p2.clone(), point: p2.coords },
        ];

        let tree = rstar::RTree::bulk_load(items);
        let aabb = rstar::AABB::from_corners([27.0, 53.5], [28.0, 54.5]);
        let found: Vec<&PlaceSpatialItem> = tree.locate_in_envelope_intersecting(&aabb).collect();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].place.name, "Minsk");
    }
}

