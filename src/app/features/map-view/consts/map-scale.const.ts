export interface ScalePreset {
  label: string;
  scale: number;
  zoom: number;
}

export interface ScaleBarSection {
  widthPx: number;
  label: string;
  isDark: boolean;
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: '1 : 25 000 (в 1 см - 250 м)', scale: 25000, zoom: 14.2 },
  { label: '1 : 50 000 (в 1 см - 500 м)', scale: 50000, zoom: 13.2 },
  { label: '1 : 100 000 (в 1 см - 1 км)', scale: 100000, zoom: 12.2 },
  { label: '1 : 200 000 (в 1 см - 2 км)', scale: 200000, zoom: 11.2 },
  { label: '1 : 500 000 (в 1 см - 5 км)', scale: 500000, zoom: 9.8 }
];
