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

// Калиброванные зум-уровни для геодезической широты Беларуси (~53.9° N) на 96 DPI экране
export const SCALE_PRESETS: ScalePreset[] = [
  { label: '1 : 2 500 (в 1 см - 25 м)', scale: 2500, zoom: 17.09 },
  { label: '1 : 5 000 (в 1 см - 50 м)', scale: 5000, zoom: 16.09 },
  { label: '1 : 10 000 (в 1 см - 100 м)', scale: 10000, zoom: 15.09 },
  { label: '1 : 25 000 (в 1 см - 250 м)', scale: 25000, zoom: 13.77 },
  { label: '1 : 50 000 (в 1 см - 500 м)', scale: 50000, zoom: 12.77 },
  { label: '1 : 100 000 (в 1 см - 1 км)', scale: 100000, zoom: 11.77 },
  { label: '1 : 200 000 (в 1 см - 2 км)', scale: 200000, zoom: 10.77 },
  { label: '1 : 500 000 (в 1 см - 5 км)', scale: 500000, zoom: 9.45 },
  { label: '1 : 1 000 000 (в 1 см - 10 км)', scale: 1000000, zoom: 8.45 },
  { label: '1 : 2 000 000 (в 1 см - 20 км)', scale: 2000000, zoom: 7.45 },
  { label: '1 : 5 000 000 (в 1 см - 50 км)', scale: 5000000, zoom: 6.13 }
];
