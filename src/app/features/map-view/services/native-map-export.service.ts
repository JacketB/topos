import { Injectable } from '@angular/core';

export interface NativeMapExportParams {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  width_mm: number;
  height_mm: number;
  dpi: number;
  scale: number;
  logical_width: number;
  logical_height: number;
  ratio: number;
  filename: string;
  target_path?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NativeMapExportService {
  /**
   * Вызов нативного экспорта карты через Tauri IPC.
   * @param params Параметры экспорта
   * @param styleJson Текущий стиль карты (JSON string)
   * @param geojsonData Тактические знаки и объекты (GeoJSON string)
   * @param imagesJson Условные знаки (JSON string)
   */
  async exportMapNative(
    params: NativeMapExportParams,
    styleJson: string,
    geojsonData: string,
    imagesJson: string
  ): Promise<string> {
    try {
      const normalizedBearing = ((params.bearing % 360) + 360) % 360;
      const clampedPitch = Math.max(0, Math.min(60, params.pitch || 0));
      const safeParams: NativeMapExportParams = {
        ...params,
        bearing: normalizedBearing,
        pitch: clampedPitch
      };
      const { invoke } = await import('@tauri-apps/api/core');
      const savedPath = await invoke<string>('export_map_native', {
        params: safeParams,
        styleJson,
        geojsonData,
        imagesJson
      });
      return savedPath;
    } catch (error) {
      console.error('Native map export failed:', error);
      throw error;
    }
  }
}
