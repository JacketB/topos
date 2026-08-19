import { describe, it, expect } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { MapView } from './map-view';
import { MapViewModel } from './viewmodels/map.viewmodel';

describe('MapView', () => {
  it('should instantiate MapView component', () => {
    const mockVm = {
      isLayersPanelOpen: signal(false),
      activeTab: signal('catalog'),
      sidebarWidth: signal(300),
      isElevationProfileOpen: signal(false),
      isMapExportOpen: signal(false),
      isMarchRouteModalOpen: signal(false),
      isMarchOrderModalOpen: signal(false),
      isDistrictSummaryModalOpen: signal(false),
      isPlannerOpen: signal(false),
      activeCalculationGroup: signal(null),
      tacticalMap: {
        activeLineMode: signal(null),
        drawingService: {
          activeLineMode: signal(null),
          cancelDrawing: () => {}
        },
        selectedSymbol: signal(null),
        selectedLine: signal(null),
        clearSelection: () => {}
      }
    };

    const injector = Injector.create({
      providers: [
        { provide: MapViewModel, useValue: mockVm }
      ]
    });

    const component = runInInjectionContext(injector, () => new MapView());
    expect(component).toBeTruthy();
  });
});
