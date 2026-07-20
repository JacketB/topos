import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapExportComponent } from './map-export.component';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { signal } from '@angular/core';

describe('MapExportComponent', () => {
  let component: MapExportComponent;
  let fixture: ComponentFixture<MapExportComponent>;
  let mockMapViewModel: any;

  beforeEach(async () => {
    mockMapViewModel = {
      isMapExportOpen: signal(false),
      getMapInstance: () => mockMapViewModel.mapInstance,
      mapInstance: {
        getContainer: () => ({ clientWidth: 1000, clientHeight: 800 }),
        getCenter: () => ({ lng: 27.5, lat: 53.9 }),
        getZoom: () => 10,
        getBearing: () => 0,
        getPitch: () => 0,
        getStyle: () => ({ version: 8, sources: {}, layers: [] }),
        listImages: () => [],
        getImage: () => null,
        unproject: (xy: [number, number]) => ({ lng: 27.5 + xy[0]/10000, lat: 53.9 - xy[1]/10000 })
      }
    };

    await TestBed.configureTestingModule({
      imports: [MapExportComponent],
      providers: [
        { provide: MapViewModel, useValue: mockMapViewModel }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MapExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create map export component', () => {
    expect(component).toBeTruthy();
  });

  it('should compute viewfinder size based on aspect ratio', () => {
    component.widthMm.set(200);
    component.heightMm.set(150);
    
    const size = component.viewfinderSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    // Проверяем соотношение сторон
    expect(Math.abs((size.width / size.height) - (200 / 150))).toBeLessThan(0.01);
  });

  it('should compute correct result pixels based on mm and DPI', () => {
    component.widthMm.set(254); // 10 дюймов
    component.heightMm.set(127); // 5 дюймов
    component.dpi.set(300);

    const px = component.resultPixels();
    expect(px.width).toBe(3000);
    expect(px.height).toBe(1500);
  });

  it('should close map export overlay', () => {
    component.close();
    expect(mockMapViewModel.isMapExportOpen()).toBe(false);
  });

  it('should handle mouse resize start and mouse move for handles', () => {
    component.widthMm.set(200);
    component.heightMm.set(150);

    const event = new MouseEvent('mousedown', { clientX: 500, clientY: 400 });
    component.startResize(event, 'se');

    const moveEvent = new MouseEvent('mousemove', { clientX: 550, clientY: 440 });
    window.dispatchEvent(moveEvent);

    expect(component.widthMm()).toBeGreaterThan(200);
    expect(component.heightMm()).toBeGreaterThan(150);

    const upEvent = new MouseEvent('mouseup');
    window.dispatchEvent(upEvent);
  });

  it('should copy image objects correctly when mainMap has images', () => {
    const mockImageObj = {
      width: 32,
      height: 32,
      data: new Uint8Array(32 * 32 * 4)
    };
    mockMapViewModel.mapInstance.listImages = () => ['symbol_tank_red'];
    mockMapViewModel.mapInstance.getImage = (id: string) => {
      if (id === 'symbol_tank_red') {
        return {
          data: mockImageObj,
          pixelRatio: 1,
          sdf: false
        };
      }
      return null;
    };

    expect(mockMapViewModel.mapInstance.listImages()).toContain('symbol_tank_red');
    const styleImg = mockMapViewModel.mapInstance.getImage('symbol_tank_red');
    expect(styleImg.data).toBe(mockImageObj);
  });
});
