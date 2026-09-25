import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { TacticalAnalyticsService } from './tactical-analytics.service';
import { MapMeasurementService } from './map-measurement.service';
import { TerrainService } from './terrain.service';

describe('Milestone 3 Analytics & Geodesy Services', () => {
  let analyticsService: TacticalAnalyticsService;
  let measurementService: MapMeasurementService;

  beforeEach(() => {
    measurementService = new MapMeasurementService();
    const injector = Injector.create({
      providers: [
        { provide: TerrainService, useValue: { getApproxElevation: async () => 100, getElevationAt: () => 100 } }
      ]
    });
    analyticsService = runInInjectionContext(injector, () => new TacticalAnalyticsService());
  });

  it('should create services', () => {
    expect(analyticsService).toBeTruthy();
    expect(measurementService).toBeTruthy();
  });

  it('should calculate initial true bearing correctly', () => {
    // Азимут строго на север (0 градусов)
    const p1: [number, number] = [27.56, 53.90];
    const p2: [number, number] = [27.56, 54.90];
    const bearing = measurementService.calculateBearing(p1, p2);
    expect(Math.round(bearing)).toBe(0);
  });

  it('should calculate initial true bearing east correctly', () => {
    // Азимут на восток (около 90 градусов)
    const p1: [number, number] = [27.56, 53.90];
    const p2: [number, number] = [28.56, 53.90];
    const bearing = measurementService.calculateBearing(p1, p2);
    expect(Math.round(bearing)).toBeGreaterThanOrEqual(88);
    expect(Math.round(bearing)).toBeLessThanOrEqual(92);
  });

  it('should calculate polygon area correctly', () => {
    // Прямоугольный участок
    const points: [number, number][] = [
      [27.56, 53.90],
      [27.57, 53.90],
      [27.57, 53.91],
      [27.56, 53.91]
    ];
    const area = measurementService.calculatePolygonArea(points);
    expect(area).toBeGreaterThan(500000); // Больше 50 га
  });

  it('should generate range ring default configuration', () => {
    expect(analyticsService.defaultRings.length).toBe(4);
    expect(analyticsService.defaultRings[0].radiusMeters).toBe(500);
    expect(analyticsService.defaultRings[3].radiusMeters).toBe(5000);
  });

  it('should toggle range rings on and off', () => {
    const mockMap: any = {
      isStyleLoaded: () => true,
      getStyle: () => ({}),
      getSource: () => ({ setData: () => {} }),
      addSource: () => {},
      getLayer: () => ({}),
      addLayer: () => {},
      getCenter: () => ({ lng: 27.56, lat: 53.90 }),
      on: () => {},
      once: () => {}
    };

    expect(analyticsService.isRangeRingsActive()).toBe(false);
    analyticsService.toggleRangeRings([27.56, 53.90], mockMap);
    expect(analyticsService.isRangeRingsActive()).toBe(true);
    expect(analyticsService.rangeRingsCenter()).toEqual([27.56, 53.90]);

    analyticsService.toggleRangeRings(null, mockMap);
    expect(analyticsService.isRangeRingsActive()).toBe(false);
    expect(analyticsService.rangeRingsCenter()).toBeNull();
  });

  it('should toggle viewshed on and off', () => {
    const mockMap: any = {
      isStyleLoaded: () => true,
      getStyle: () => ({}),
      getSource: () => ({ setData: () => {} }),
      addSource: () => {},
      getLayer: () => ({}),
      addLayer: () => {},
      getCenter: () => ({ lng: 27.56, lat: 53.90 }),
      on: () => {},
      once: () => {}
    };

    expect(analyticsService.isViewshedActive()).toBe(false);
    analyticsService.toggleViewshed([27.56, 53.90], mockMap);
    expect(analyticsService.isViewshedActive()).toBe(true);
    expect(analyticsService.viewshedCenter()).toEqual([27.56, 53.90]);

    analyticsService.toggleViewshed(null, mockMap);
    expect(analyticsService.isViewshedActive()).toBe(false);
    expect(analyticsService.viewshedCenter()).toBeNull();
  });

  it('should update viewshed parameters', () => {
    analyticsService.setObserverHeight(2.5);
    expect(analyticsService.observerHeightM()).toBe(2.5);

    analyticsService.setTargetHeight(3.0);
    expect(analyticsService.targetHeightM()).toBe(3.0);

    analyticsService.setMaxRadius(5000);
    expect(analyticsService.maxRadiusM()).toBe(5000);
  });

  it('should recalculate layers for screen center', () => {
    let currentCenter = { lng: 27.56, lat: 53.90 };
    const mockMap: any = {
      isStyleLoaded: () => true,
      getStyle: () => ({}),
      getSource: () => ({ setData: () => {} }),
      addSource: () => {},
      getLayer: () => ({}),
      addLayer: () => {},
      getCenter: () => currentCenter,
      on: () => {},
      once: () => {}
    };

    analyticsService.initLayers(mockMap);
    analyticsService.toggleRangeRings([27.56, 53.90], mockMap);
    analyticsService.toggleViewshed([27.56, 53.90], mockMap);

    currentCenter = { lng: 28.00, lat: 54.00 };
    analyticsService.recalculateForScreenCenter();

    expect(analyticsService.rangeRingsCenter()).toEqual([28.00, 54.00]);
    expect(analyticsService.viewshedCenter()).toEqual([28.00, 54.00]);
  });
});
