import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageOverlayService, MapImageOverlay } from './image-overlay.service';

const storageMap: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storageMap[k] ?? null,
  setItem: (k: string, v: string) => { storageMap[k] = String(v); },
  removeItem: (k: string) => { delete storageMap[k]; },
  clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

describe('ImageOverlayService - Storage and Persistence', () => {
  let service: ImageOverlayService;

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('should load initial overlays from localStorage on instantiation', () => {
    const mockOverlays: MapImageOverlay[] = [
      {
        id: 'img-1',
        name: 'Схема 1',
        url: 'data:image/png;base64,ABC',
        coordinates: [[27.5, 53.9], [27.6, 53.9], [27.6, 53.8], [27.5, 53.8]],
        opacity: 0.7,
        locked: true,
        center: [27.55, 53.85],
        widthMeters: 1500,
        aspectRatio: 1.5,
        bearing: 0
      }
    ];

    mockLocalStorage.setItem('topos_image_overlays', JSON.stringify(mockOverlays));

    service = new ImageOverlayService();

    expect(service.overlays()).toEqual(mockOverlays);
  });

  it('should save to localStorage when updating opacity, locked state or removing overlay', () => {
    const mockOverlays: MapImageOverlay[] = [
      {
        id: 'img-1',
        name: 'Схема 1',
        url: 'data:image/png;base64,ABC',
        coordinates: [[27.5, 53.9], [27.6, 53.9], [27.6, 53.8], [27.5, 53.8]],
        opacity: 0.5,
        locked: false,
        center: [27.55, 53.85],
        widthMeters: 1500,
        aspectRatio: 1.5,
        bearing: 0
      }
    ];

    service = new ImageOverlayService();
    service.loadOverlays(mockOverlays);

    expect(service.overlays().length).toBe(1);
    expect(JSON.parse(mockLocalStorage.getItem('topos_image_overlays') || '[]')).toEqual(mockOverlays);

    service.setOpacity('img-1', 0.85);
    expect(service.overlays()[0].opacity).toBe(0.85);
    expect(JSON.parse(mockLocalStorage.getItem('topos_image_overlays') || '[]')[0].opacity).toBe(0.85);

    service.setLocked('img-1', true);
    expect(service.overlays()[0].locked).toBe(true);
    expect(JSON.parse(mockLocalStorage.getItem('topos_image_overlays') || '[]')[0].locked).toBe(true);

    service.removeOverlay('img-1');
    expect(service.overlays().length).toBe(0);
    expect(JSON.parse(mockLocalStorage.getItem('topos_image_overlays') || '[]').length).toBe(0);
  });
});
