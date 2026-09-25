import '@angular/compiler';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'calculate_viewshed') {
      return Promise.resolve({
        type: 'FeatureCollection',
        features: []
      });
    }
    return Promise.resolve(null);
  })
}));
