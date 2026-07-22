use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use tauri::http::Response;
use tauri::Manager;

fn resolve_asset_path(app: &tauri::AppHandle, uri_path: &str) -> Result<std::path::PathBuf, String> {
    let decoded_path = uri_path.replace("%20", " ");
    let clean_path = decoded_path.trim_start_matches('/');

    if let Ok(resource_dir) = app.path().resource_dir() {
        let path_res = resource_dir.join("assets").join(clean_path);
        if path_res.exists() { return Ok(path_res); }

        let path_flat = resource_dir.join(clean_path);
        if path_flat.exists() { return Ok(path_flat); }

        let path_under_res = resource_dir.join("resources").join(clean_path);
        if path_under_res.exists() { return Ok(path_under_res); }
    }

    let current_dir = std::env::current_dir().expect("Failed to get current dir");
    let base_dir = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap().to_path_buf()
    } else {
        current_dir.clone()
    };

    let path1 = base_dir.join("assets").join(clean_path);
    if path1.exists() { return Ok(path1); }

    let path2 = base_dir.join("dist").join("assets").join(clean_path);
    if path2.exists() { return Ok(path2); }

    let path3 = base_dir.join("src-tauri").join("assets").join(clean_path);
    if path3.exists() { return Ok(path3); }

    Err(format!(
        "File '{}' not found in assets or resource paths: {:?}, {:?}, {:?}",
        clean_path, path1, path2, path3
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
        .invoke_handler(tauri::generate_handler![read_pmtiles_chunk, save_scenario_file, export_map_native])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
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

    // Интегрируем GeoJSON данные во внутренний источник стиля для надежности
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

    // Дополнительно валидируем все GeoJSON источники стиля
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

    let mut config = serde_json::json!({
        "zoom": params.zoom,
        "width": params.logical_width,
        "height": params.logical_height,
        "center": params.center,
        "bearing": params.bearing,
        "pitch": params.pitch,
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

    let run_res = run_node_renderer(&script_path, &config_str, &output_path);
    run_res.map(|_| output_path.to_string_lossy().to_string())
}

fn run_node_renderer(
    script_path: &std::path::Path,
    config_str: &str,
    output_path: &std::path::Path,
) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let script_dir = script_path.parent().ok_or_else(|| "Failed to get script parent directory".to_string())?;

    #[cfg(target_os = "windows")]
    let mut command = {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("node");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
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

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr).into_owned();
        return Err(format!("Node renderer error: {}", err_msg));
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout).into_owned();
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
        let result = run_node_renderer(&script_path, &config_str, &output_path);
        println!("Test run result: {:?}", result);
        
        if output_path.exists() {
            let _ = std::fs::remove_file(output_path);
        }

        assert!(result.is_ok(), "Renderer test failed: {:?}", result.err());
    }
}
