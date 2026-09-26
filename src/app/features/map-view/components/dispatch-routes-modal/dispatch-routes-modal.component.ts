import { Component, inject, signal, computed, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { DispatchRoutesService, DispatchAddress, DispatchRoute } from '../../services/dispatch-routes.service';
import * as XLSX from 'xlsx-js-style';
import { ExcelStylerUtils } from '../../utils/excel-styler.utils';

@Component({
  selector: 'app-dispatch-routes-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispatch-routes-modal.component.html',
  styleUrls: ['./dispatch-routes-modal.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DispatchRoutesModalComponent {
  readonly vm = inject(MapViewModel);
  readonly dispatchService = inject(DispatchRoutesService);

  readonly activeTab = signal<'addresses' | 'params' | 'results'>('addresses');
  readonly searchQuery = signal<string>('');
  readonly selectedRouteIndex = signal<number | null>(null);
  readonly isExporting = signal<boolean>(false);
  readonly isExportingGeoJson = signal<boolean>(false);
  readonly saveStatusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly addresses = this.dispatchService.addresses;
  readonly routes = this.dispatchService.routes;
  readonly config = this.dispatchService.config;
  readonly isCalculating = this.dispatchService.isCalculating;
  readonly pickingTarget = this.vm.pickingDispatchTarget;

  readonly geocodedCount = computed(() => {
    return this.addresses().filter(a => a.coords !== null).length;
  });

  readonly pendingCount = computed(() => {
    return this.addresses().length - this.geocodedCount();
  });

  readonly filteredAddresses = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.addresses();
    if (!q) return list;
    return list.filter(a =>
      a.recipientName.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.street.toLowerCase().includes(q) ||
      a.house.toLowerCase().includes(q) ||
      (a.note && a.note.toLowerCase().includes(q))
    );
  });

  readonly totalStats = computed(() => {
    const rList = this.routes();
    if (rList.length === 0) {
      return { totalDistKm: 0, totalDurationMin: 0, totalAddrs: 0 };
    }
    const totalDistKm = Math.round(rList.reduce((acc, r) => acc + r.totalDistanceKm, 0) * 10) / 10;
    const totalDurationMin = rList.reduce((acc, r) => acc + r.totalDurationMin, 0);
    const totalAddrs = rList.reduce((acc, r) => acc + r.addresses.length, 0);
    return { totalDistKm, totalDurationMin, totalAddrs };
  });

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.errorMessage.set(null);

    try {
      const parsed = await this.dispatchService.parseExcelFile(file);
      if (parsed.length === 0) {
        this.errorMessage.set('Не удалось найти строки с адресами в выбранном файле');
        return;
      }

      const geocoded = await this.dispatchService.autoGeocodeBySettlements(parsed);
      this.dispatchService.addresses.set(geocoded);

      if (this.config().startPoint === null && geocoded.length > 0) {
        const firstGeocoded = geocoded.find(g => g.coords !== null);
        if (firstGeocoded && firstGeocoded.coords) {
          this.config.update(c => ({
            ...c,
            startPoint: firstGeocoded.coords,
            startPointName: `${firstGeocoded.city || 'Пункт'} (По первому адресу)`
          }));
        }
      }

      this.dispatchService.updateMapLayers(this.vm.getMapInstance());
    } catch (e: any) {
      this.errorMessage.set(`Ошибка чтения Excel: ${e?.message || e}`);
    } finally {
      input.value = '';
    }
  }

  downloadTemplate(): void {
    const wb = this.dispatchService.generateTemplateWorkbook();
    ExcelStylerUtils.saveWorkbookWithDialog(wb, 'Шаблон_оповещения_адреса.xlsx');
  }

  getTargetAddressName(): string {
    const t = this.pickingTarget();
    if (!t) return '';
    if (t === 'start') return 'Стартовая точка';
    const a = this.addresses().find(item => item.id === t);
    if (!a) return 'Адрес';
    const parts = [a.recipientName];
    if (a.city) parts.push(a.city);
    if (a.street) parts.push(a.street + (a.house ? ' ' + a.house : ''));
    return parts.join(' | ');
  }

  addManualAddress(): void {
    const current = this.addresses();
    const newIdx = current.length + 1;
    const newAddr: DispatchAddress = {
      id: `manual_${Date.now()}_${newIdx}`,
      index: newIdx,
      recipientName: `Адресат ${newIdx}`,
      city: '',
      street: '',
      house: '',
      coords: null,
      geocoded: false
    };
    this.dispatchService.addresses.update(prev => [...prev, newAddr]);
  }

  removeAddress(id: string): void {
    this.dispatchService.addresses.update(prev => prev.filter(a => a.id !== id));
    this.dispatchService.updateMapLayers(this.vm.getMapInstance());
  }

  clearAllAddresses(): void {
    this.dispatchService.addresses.set([]);
    this.dispatchService.routes.set([]);
    this.dispatchService.clearMapLayers(this.vm.getMapInstance());
    this.selectedRouteIndex.set(null);
  }

  pickAddressOnMap(id: string): void {
    this.vm.setPickingDispatchTarget(id);
  }

  pickStartPointOnMap(): void {
    this.vm.setPickingDispatchTarget('start');
  }

  cancelPicking(): void {
    this.vm.setPickingDispatchTarget(null);
  }

  focusAddress(addr: DispatchAddress): void {
    if (addr.coords) {
      this.vm.moveToCoordinates(addr.coords[1], addr.coords[0]);
    }
  }

  focusRoute(route: DispatchRoute): void {
    if (route.geometry && route.geometry.length > 0) {
      const mid = route.geometry[Math.floor(route.geometry.length / 2)];
      this.vm.moveToCoordinates(mid[1], mid[0]);
    }
  }

  async runCalculation(): Promise<void> {
    const cfg = this.config();
    if (!cfg.startPoint) {
      this.errorMessage.set('Укажите стартовую точку для построения маршрутов');
      return;
    }

    const addrs = this.addresses();
    const valid = addrs.filter(a => a.coords !== null);
    if (valid.length === 0) {
      this.errorMessage.set('Нет адресов с указанными координатами. Задайте координаты кликом на карте или в файле');
      return;
    }

    this.errorMessage.set(null);
    this.saveStatusMessage.set(null);
    this.dispatchService.isCalculating.set(true);

    try {
      const calculated = await this.dispatchService.buildDispatchRoutes(cfg.startPoint, valid, cfg);
      this.dispatchService.routes.set(calculated);
      this.dispatchService.updateMapLayers(this.vm.getMapInstance());
      this.activeTab.set('results');
      if (calculated.length > 0) {
        this.selectedRouteIndex.set(0);
        this.focusRoute(calculated[0]);
      }
    } catch (e: any) {
      this.errorMessage.set(`Ошибка расчета: ${e?.message || e}`);
    } finally {
      this.dispatchService.isCalculating.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    this.isExporting.set(true);
    this.saveStatusMessage.set(null);
    try {
      const ok = await this.dispatchService.exportRoutesToExcelFile(this.routes(), this.config());
      if (ok) {
        this.saveStatusMessage.set('Маршрутные листы оповещения успешно сохранены в файл Excel.');
      }
    } catch (e: any) {
      this.errorMessage.set(`Ошибка сохранения Excel: ${e?.message || e}`);
    } finally {
      this.isExporting.set(false);
    }
  }

  async exportGeoJson(): Promise<void> {
    this.isExportingGeoJson.set(true);
    this.saveStatusMessage.set(null);
    try {
      const ok = await this.dispatchService.saveRoutesToGeoJsonFile(this.routes(), this.config());
      if (ok) {
        this.saveStatusMessage.set('Векторные трассы маршрутов успешно сохранены в файл GeoJSON.');
      }
    } catch (e: any) {
      this.errorMessage.set(`Ошибка сохранения GeoJSON: ${e?.message || e}`);
    } finally {
      this.isExportingGeoJson.set(false);
    }
  }

  saveToTacticalMap(): void {
    const count = this.dispatchService.saveRoutesToTacticalMap(this.routes(), this.config());
    if (count > 0) {
      this.saveStatusMessage.set(`На тактическую карту нанесено ${count} объектов обстановки (трассы маршрутов и точки адресов).`);
    } else {
      this.errorMessage.set('Не удалось нанести объекты на карту обстановки.');
    }
  }

  readonly hiddenRouteIds = this.dispatchService.hiddenRouteIds;

  isRouteVisible(routeId: string): boolean {
    return this.dispatchService.isRouteVisible(routeId);
  }

  toggleRouteVisibility(routeId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.dispatchService.toggleRouteVisibility(routeId);
    this.dispatchService.updateMapLayers(this.vm.getMapInstance());
  }

  isolateRoute(routeId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.dispatchService.isolateRoute(routeId);
    this.dispatchService.updateMapLayers(this.vm.getMapInstance());
  }

  showAllRoutes(): void {
    this.dispatchService.showAllRoutes();
    this.dispatchService.updateMapLayers(this.vm.getMapInstance());
  }

  hideAllRoutes(): void {
    this.dispatchService.hideAllRoutes();
    this.dispatchService.updateMapLayers(this.vm.getMapInstance());
  }

  setTransportMode(mode: 'foot' | 'car'): void {
    this.config.update(c => ({
      ...c,
      transportMode: mode,
      speedKmH: mode === 'foot' ? 4.5 : 30
    }));
  }

  formatDuration(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins} мин`;
    return `${hrs} ч ${mins.toString().padStart(2, '0')} мин`;
  }

  closeModal(): void {
    this.vm.closeDispatchModal();
  }
}
