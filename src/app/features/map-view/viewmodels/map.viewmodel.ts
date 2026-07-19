import { Injectable, signal, inject, computed, effect } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbolsService } from '../services/tactical-symbols.service';
import { TacticalMapService } from '../services/tactical-map.service';
import { TerrainService } from '../services/terrain.service';
import { MapScaleService } from '../services/map-scale.service';
import { MapMeasurementService } from '../services/map-measurement.service';
import { MapLayersService } from '../services/map-layers.service';
import { SCALE_PRESETS, ScalePreset } from '../consts/map-scale.const';
import { FortificationCalculationService } from '../services/fortification-calculation.service';
import { MarchRouteService, ColumnType, MarchRoute } from '../services/march-route.service';
import { PlaybackService } from '../services/playback.service';
import { MarchOrderService, MarchOrderElement } from '../services/march-order.service';
import { ImageOverlayService, MapImageOverlay } from '../services/image-overlay.service';

@Injectable({
  providedIn: 'root'
})
export class MapViewModel {
  readonly imageOverlayService = inject(ImageOverlayService);
  readonly symbolsService = inject(TacticalSymbolsService);
  readonly tacticalMapService = inject(TacticalMapService);
  readonly terrainService = inject(TerrainService);
  readonly mapScaleService = inject(MapScaleService);
  readonly mapMeasurementService = inject(MapMeasurementService);
  readonly mapLayersService = inject(MapLayersService);
  readonly fortificationService = inject(FortificationCalculationService);
  readonly marchRouteService = inject(MarchRouteService);
  readonly playbackService = inject(PlaybackService);
  readonly marchOrderService = inject(MarchOrderService);

  readonly scalePresets = SCALE_PRESETS;

  readonly isAppReady = signal<boolean>(false);
  readonly sidebarWidth = signal<number>(340);
  readonly bearing = signal<number>(0);
  readonly cursorCoords = signal<string>('53.9000 С.Ш., 27.5600 В.Д.');
  readonly centerCoords = signal<string>('53.9000 С.Ш., 27.5600 В.Д.');
  readonly currentScale = signal<number>(50000);
  readonly isScaleMenuOpen = signal<boolean>(false);
  readonly isQuickLayersMenuOpen = signal<boolean>(false);
  readonly isToogleMapMenuOpen = signal<boolean>(false);
  readonly activeMapId = signal<string>('map1');
  readonly isCrosshairVisible = signal<boolean>(false);
  readonly isEditingCoords = signal<boolean>(false);
  readonly isLineSmooth = signal<boolean>(false);
  readonly isTerrainOrientationEnabled = this.tacticalMapService.isTerrainOrientationEnabled;
  readonly zoomLevel = signal<number>(10);
  readonly zoomPercentText = computed(() => {
    const zoom = this.zoomLevel();
    const percent = Math.round(100 * Math.pow(2, zoom - 13.2));
    return `${percent}%`;
  });
  readonly manuallyOpenedCategories = signal<Record<string, boolean>>({});

  readonly isMeasuring = this.mapMeasurementService.isMeasuring;
  readonly measurementResult = this.mapMeasurementService.measurementResult;
  readonly symbolSearchQuery = this.symbolsService.symbolSearchQuery;
  readonly selectedSymbol = this.tacticalMapService.selectedSymbol;
  readonly selectedPlacedSymbol = this.tacticalMapService.selectedPlacedSymbol;
  readonly selectedPlacedSymbols = this.tacticalMapService.selectedPlacedSymbols;
  readonly objectGroups = this.tacticalMapService.objectGroups;
  readonly activeCalculationGroupId = this.tacticalMapService.activeCalculationGroupId;
  readonly isLayersPanelOpen = signal<boolean>(false);
  readonly isSelectionModeActive = computed(() => this.tacticalMapService.interactionMode() === 'select');
  readonly placedSymbols = this.tacticalMapService.placedSymbols;
  readonly layerGroups = this.mapLayersService.groups;

  readonly isAreaReportOpen = signal<boolean>(false);

  readonly selectedPlacedSymbolNorms = computed(() => {
    const selected = this.selectedPlacedSymbol();
    if (!selected) return null;
    return this.fortificationService.calculateFeatureNorms(selected);
  });

  readonly placedFortifications = computed(() => {
    const placed = this.placedSymbols();
    const activeGroupId = this.activeCalculationGroupId();
    let filtered = placed;
    if (activeGroupId && activeGroupId !== 'all') {
      const group = this.objectGroups().find((g: any) => g.id === activeGroupId);
      if (group) {
        filtered = placed.filter(f => group.elementIds.includes(f.properties?.id));
      }
    }
    return filtered.filter(f => {
      if (f.properties?.isLinear) {
        return ['trench', 'comm_open', 'comm_covered', 'wire'].includes(f.properties.lineType);
      }
      return !!this.fortificationService.pointNorms[f.properties?.symbol];
    });
  });

  readonly placedFortificationsCount = computed(() => {
    return this.placedFortifications().length;
  });

  readonly totalAreaNorms = computed(() => {
    const fortList = this.placedFortifications();
    return this.fortificationService.calculateTotalNorms(fortList);
  });

  readonly marchColumnType = signal<ColumnType>('wheel');
  readonly marchIsNight = signal<boolean>(false);
  readonly selectedMarchRouteStats = signal<MarchRoute | null>(null);

  readonly playbackSpeed = this.playbackService.speedMultiplier;
  readonly isPlayingPlayback = this.playbackService.isPlaying;
  readonly playbackTime = this.playbackService.currentTimeHrs;

  readonly playbackPosition = computed(() => {
    const stats = this.selectedMarchRouteStats();
    const time = this.playbackTime();
    if (!stats) return null;
    return this.playbackService.getPositionAtTime(stats, time);
  });

  readonly playbackRoadType = computed(() => {
    const pos = this.playbackPosition();
    return pos ? pos.currentRoadType : '';
  });

  readonly playbackCurrentSpeed = computed(() => {
    const pos = this.playbackPosition();
    return pos ? pos.currentSpeed : 0;
  });

  constructor() {
    // Обновление положения маркера симуляции на карте
    effect(() => {
      const pos = this.playbackPosition();
      if (pos) {
        this.tacticalMapService.updatePlaybackMarker(pos.coords, pos.bearing);
      } else {
        this.tacticalMapService.updatePlaybackMarker(null);
      }
    });

    // Сброс симуляции при смене выбранного символа или режима рисования
    effect(() => {
      this.selectedPlacedSymbol();
      this.activeLineMode();
      this.playbackService.reset();
    });

    // Автоматически закрываем открытые попапы при открытии правого или левого сайдбара (выбор объекта, шаблона, начало рисования или открытия слоев)
    effect(() => {
      const isAnySidebarOpen = !!(
        this.selectedPlacedSymbol() || 
        this.selectedSymbol() || 
        this.activeLineMode() !== 'none' ||
        this.isLayersPanelOpen()
      );
      if (isAnySidebarOpen) {
        this.closeAllPopupsExcept();
      }
    });

    // Сброс режима выделения при начале размещения символов или рисовании линий
    effect(() => {
      if (this.selectedSymbol() || this.activeLineMode() !== 'none') {
        this.tacticalMapService.interactionMode.set('edit');
      }
    });

    // Синхронизируем вершины waypoints при рисовании маршрута
    effect(() => {
      const mode = this.activeLineMode();
      const coords = this.activeLineCoords();
      if (mode === 'march_route') {
        this.tacticalMapService.updateMarchWaypointsSource(coords);
      } else {
        this.tacticalMapService.updateMarchWaypointsSource(undefined);
      }
    });

    // Реактивно пересчитываем характеристики маршрута
    effect(async () => {
      const selected = this.selectedPlacedSymbol();
      const mode = this.activeLineMode();
      const activeCoords = this.activeLineCoords();
      const columnType = this.marchColumnType();
      const isNight = this.marchIsNight();
      const map = this.mapInstance;

      if (!map) {
        this.selectedMarchRouteStats.set(null);
        return;
      }

      if (mode === 'march_route' && activeCoords && activeCoords.length >= 2) {
        const stats = await this.marchRouteService.calculateRouteStats(map, activeCoords, columnType, isNight);
        this.selectedMarchRouteStats.set(stats);
      } else if (selected && selected.properties?.['lineType'] === 'march_route') {
        const origCoords = selected.properties['origCoords'] as [number, number][];
        if (origCoords && origCoords.length >= 2) {
          const stats = await this.marchRouteService.calculateRouteStats(map, origCoords, columnType, isNight);
          this.selectedMarchRouteStats.set(stats);
        } else {
          this.selectedMarchRouteStats.set(null);
        }
      } else {
        this.selectedMarchRouteStats.set(null);
      }
    });
  }

  closeAllPopupsExcept(except?: 'areaReport' | 'marchOrder' | 'fortPlanner' | 'imageOverlay' | 'categoryDropdown' | 'quickLayers' | 'toggleMap' | 'scale') {
    if (except !== 'areaReport') this.isAreaReportOpen.set(false);
    if (except !== 'marchOrder') this.isMarchOrderOpen.set(false);
    if (except !== 'fortPlanner') this.isFortPlannerOpen.set(false);
    if (except !== 'imageOverlay') this.isImageOverlayPanelOpen.set(false);
    if (except !== 'categoryDropdown') this.activeCategoryDropdown.set(null);
    if (except !== 'quickLayers') this.isQuickLayersMenuOpen.set(false);
    if (except !== 'toggleMap') this.isToogleMapMenuOpen.set(false);
    if (except !== 'scale') this.isScaleMenuOpen.set(false);
  }

  toggleAreaReport() {
    if (!this.isAreaReportOpen()) {
      this.closeAllPopupsExcept('areaReport');
    }
    this.isAreaReportOpen.update(v => !v);
  }

  readonly isMarchOrderOpen = signal<boolean>(false);

  toggleMarchOrder() {
    if (!this.isMarchOrderOpen()) {
      this.closeAllPopupsExcept('marchOrder');
    }
    this.isMarchOrderOpen.update(v => !v);
  }

  readonly isFortPlannerOpen = signal<boolean>(false);

  toggleFortPlanner() {
    if (!this.isFortPlannerOpen()) {
      this.closeAllPopupsExcept('fortPlanner');
    }
    this.isFortPlannerOpen.update(v => !v);
  }

  readonly isImageOverlayPanelOpen = signal<boolean>(false);

  toggleImageOverlayPanel() {
    if (!this.isImageOverlayPanelOpen()) {
      this.closeAllPopupsExcept('imageOverlay');
    }
    this.isImageOverlayPanelOpen.update(v => !v);
  }

  readonly activeCategoryDropdown = signal<string | null>(null);

  toggleCategoryDropdown(categoryId: string | null) {
    if (this.activeCategoryDropdown() === categoryId) {
      this.activeCategoryDropdown.set(null);
    } else {
      if (categoryId) {
        this.closeAllPopupsExcept('categoryDropdown');
      }
      this.activeCategoryDropdown.set(categoryId);
    }
  }


  readonly marchOrderElements = this.marchOrderService.elements;

  addMarchOrderElement(
    name: string, 
    icon: string, 
    composition: string, 
    vehicleCount: number = 5,
    vehicleLength: number = 7.5,
    vehicleDistance: number = 50,
    vehicleDistanceUnit: 'm' | 'km' = 'm',
    distanceToNext: number = 100, 
    distanceUnit: 'm' | 'km' = 'm'
  ) {
    this.marchOrderService.addElement({ 
      name, 
      icon, 
      composition, 
      vehicleCount, 
      vehicleLength,
      vehicleDistance, 
      vehicleDistanceUnit, 
      distanceToNext, 
      distanceUnit 
    });
  }

  removeMarchOrderElement(id: string) {
    this.marchOrderService.removeElement(id);
  }

  updateMarchOrderElement(id: string, updates: Partial<Omit<MarchOrderElement, 'id'>>) {
    this.marchOrderService.updateElement(id, updates);
  }

  moveMarchOrderElement(index: number, direction: 'up' | 'down') {
    this.marchOrderService.moveElement(index, direction);
  }

  getMarchOrderTotalLengthKm(): number {
    return this.marchOrderService.calculateTotalLengthKm();
  }

  getMarchOrderUnitLengthKm(el: MarchOrderElement): number {
    return this.marchOrderService.getUnitLengthKm(el);
  }


  copyAreaReportToClipboard() {
    const norms = this.totalAreaNorms();
    let text = `=== ИНЖЕНЕРНО-ФОРТИФИКАЦИОННАЯ ВЕДОМОСТЬ РАЙОНА ===\n`;
    text += `Дата расчета: ${new Date().toLocaleDateString()}\n\n`;
    text += `1. Сводные показатели:\n`;
    text += `- Объем земляных работ: ${norms.totalEarthVolume} м³\n`;
    if (norms.totalCleanVolume > 0) text += `  (в т.ч. ручная зачистка недобора: ${norms.totalCleanVolume} м³)\n`;
    text += `- Трудозатраты личного состава: ${norms.totalLaborHrs} чел.-ч\n`;
    if (norms.totalWoodVol > 0) text += `- Потребность в круглом лесе: ${norms.totalWoodVol} м³\n`;
    if (norms.totalBoardsVol > 0) text += `- Потребность в досках обшивки (пиломатериал): ${norms.totalBoardsVol} м³\n`;
    if (norms.totalPostsCount > 0) text += `- Количество вертикальных стоек: ${norms.totalPostsCount} шт.\n`;
    if (norms.totalWireKg > 0) text += `- Потребность в колючей проволоке: ${norms.totalWireKg} кг\n`;
    if (norms.totalWireViazKg > 0) text += `- Потребность в вязальной проволоке: ${norms.totalWireViazKg} кг\n`;
    if (norms.totalMetalKg > 0) text += `- Потребность в металлоконструкциях: ${norms.totalMetalKg} кг\n`;
    if (norms.totalPolesCount > 0) text += `- Количество кольев для заграждений: ${norms.totalPolesCount} шт.\n`;
    if (norms.totalMasNetSq > 0) text += `- Потребность в маскировочных сетях МКТ: ${norms.totalMasNetSq} м²\n`;
    if (norms.totalAntiDronNetSq > 0) text += `- Потребность в антидронной стальной сетке: ${norms.totalAntiDronNetSq} м²\n`;
    if (norms.totalTrapsM > 0) text += `- Водоотводные деревянные трапы: ${norms.totalTrapsM} п.м.\n`;
    if (norms.totalDoorsCount > 0) text += `- Защитно-герметические дверные блоки БД-50: ${norms.totalDoorsCount} шт.\n`;
    if (norms.totalStovesCount > 0) text += `- Отопительные полевые печи: ${norms.totalStovesCount} шт.\n`;
    
    if (norms.totalLengths.trench > 0 || norms.totalLengths.comm_open > 0 || norms.totalLengths.comm_covered > 0 || norms.totalLengths.wire > 0) {
      text += `\n2. Протяженность линейных сооружений:\n`;
      if (norms.totalLengths.trench > 0) text += `- Общая длина траншей: ${norms.totalLengths.trench} м\n`;
      if (norms.totalLengths.comm_open > 0) text += `- Общая длина открытых ходов сообщения: ${norms.totalLengths.comm_open} м\n`;
      if (norms.totalLengths.comm_covered > 0) text += `- Общая длина перекрытых щелей (крытых ходов): ${norms.totalLengths.comm_covered} м\n`;
      if (norms.totalLengths.wire > 0) text += `- Общая длина проволочных заграждений (МЗП): ${norms.totalLengths.wire} м\n`;
    }

    if (norms.machinerySummary.length > 0) {
      text += `\n3. Потребность в инженерной технике:\n`;
      norms.machinerySummary.forEach(m => {
        text += `- ${m.type}: ${m.hours} маш.-ч\n`;
      });
    }
    
    text += `\n4. Состав сооружений в районе:\n`;
    Object.keys(norms.elementsCount).forEach(k => {
      text += `- ${k}: ${norms.elementsCount[k]} шт.\n`;
    });

    if (norms.items.length > 0) {
      text += `\n5. Детальная спецификация сооружений:\n`;
      norms.items.forEach(item => {
        const namePart = item.name ? ` "${item.name}"` : '';
        text += `- ${item.type}${namePart}: земля ${item.earthVolume} м³, трудозатраты ${item.laborHrs} чел.-ч.\n`;
        const matSpecs: string[] = [];
        if (item.cleanVolume && item.cleanVolume > 0) matSpecs.push(`ручная зачистка: ${item.cleanVolume} м³`);
        if (item.woodVol && item.woodVol > 0) matSpecs.push(`круглый лес: ${item.woodVol} м³`);
        if (item.boardsVol && item.boardsVol > 0) matSpecs.push(`доски: ${item.boardsVol} м³`);
        if (item.postsCount && item.postsCount > 0) matSpecs.push(`стойки: ${item.postsCount} шт`);
        if (item.wireViazKg && item.wireViazKg > 0) matSpecs.push(`вязальная проволока: ${item.wireViazKg} кг`);
        if (item.masNetSq && item.masNetSq > 0) matSpecs.push(`мас. сети: ${item.masNetSq} м²`);
        if (item.trapsM && item.trapsM > 0) matSpecs.push(`трапы: ${item.trapsM} п.м.`);
        if (item.doorsCount && item.doorsCount > 0) matSpecs.push(`двери БД-50: ${item.doorsCount} шт`);
        if (item.stovesCount && item.stovesCount > 0) matSpecs.push(`печи полевые: ${item.stovesCount} шт`);
        if (matSpecs.length > 0) {
          text += `  Материалы и работы: ${matSpecs.join(', ')}\n`;
        }
        if (item.notes) text += `  Конфигурация: ${item.notes}\n`;
      });
    }
    
    navigator.clipboard.writeText(text).then(() => {
      alert('Ведомость скопирована в буфер обмена!');
    });
  }

  private mapInstance: maplibregl.Map | null = null;

  setMapInstance(map: maplibregl.Map) {
    this.mapInstance = map;
    if (map) {
      this.imageOverlayService.init(map);
    }
  }

  getMapInstance(): maplibregl.Map | null {
    return this.mapInstance;
  }

  toggleQuickLayersMenu() {
    const nextVal = !this.isQuickLayersMenuOpen();
    if (nextVal) {
      this.closeAllPopupsExcept('quickLayers');
    }
    this.isQuickLayersMenuOpen.set(nextVal);
  }

  toggleToogleMapMenu() {
    const nextVal = !this.isToogleMapMenuOpen();
    if (nextVal) {
      this.closeAllPopupsExcept('toggleMap');
    }
    this.isToogleMapMenuOpen.set(nextVal);
  }

  toggleLineSmooth() {
    this.isLineSmooth.update(v => !v);
    this.updateDrawingPreview();
  }

  toggleTerrainOrientation() {
    this.isTerrainOrientationEnabled.update(v => !v);
  }

  onQuickLayerToggle(groupId: string) {
    if (groupId === 'elevation') {
      const elevationGroup = this.layerGroups().find(g => g.id === 'elevation');
      const contourLayer = elevationGroup?.layers.find(l => l.id === 'contour_line');
      if (contourLayer) {
        this.mapLayersService.toggleLayer('contour_line', this.mapInstance);
        this.mapLayersService.toggleLayer('contour_label', this.mapInstance);
      } else {
        this.mapLayersService.toggleGroup('elevation', this.mapInstance);
      }
    } else {
      this.mapLayersService.toggleGroup(groupId, this.mapInstance);
    }
  }

  toggleScaleMenu(event?: Event) {
    if (event) event.stopPropagation();
    const nextVal = !this.isScaleMenuOpen();
    if (nextVal) {
      this.closeAllPopupsExcept('scale');
    }
    this.isScaleMenuOpen.set(nextVal);
  }

  toggleCrosshair() {
    this.isCrosshairVisible.update(v => !v);
  }

  onCoordsFocus() {
    this.isEditingCoords.set(true);
  }

  onCoordsBlur(event: Event) {
    this.isEditingCoords.set(false);
    const map = this.getMapInstance();
    if (map) {
      const center = map.getCenter();
      const lat = center.lat;
      const lng = center.lng;
      const latDir = lat >= 0 ? 'С.Ш.' : 'Ю.Ш.';
      const lngDir = lng >= 0 ? 'В.Д.' : 'З.Д.';
      this.cursorCoords.set(
        `${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`
      );
    }
  }

  onCoordsKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const input = event.target as HTMLInputElement;
      const parsed = this.parseCoordinates(input.value);
      if (parsed) {
        this.moveToCoordinates(parsed[0], parsed[1]);
        input.blur();
      } else {
        input.classList.add('coords-error');
        setTimeout(() => input.classList.remove('coords-error'), 1000);
      }
    } else if (event.key === 'Escape') {
      const input = event.target as HTMLInputElement;
      input.blur();
    }
  }

  moveToCoordinates(lat: number, lng: number) {
    const map = this.getMapInstance();
    if (map) {
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 13),
        duration: 1000
      });
    }
  }

  parseCoordinates(input: string): [number, number] | null {
    if (!input) return null;
    const matches = input.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!matches || matches.length < 2) return null;
    
    let lat = parseFloat(matches[0]);
    let lng = parseFloat(matches[1]);
    const upperInput = input.toUpperCase();
    
    if (upperInput.includes('В.Д.') || upperInput.includes('З.Д.') || upperInput.includes('E') || upperInput.includes('W')) {
      const latIndex = Math.max(upperInput.indexOf('С.Ш.'), upperInput.indexOf('Ю.Ш.'), upperInput.indexOf('N'), upperInput.indexOf('S'));
      const lngIndex = Math.max(upperInput.indexOf('В.Д.'), upperInput.indexOf('З.Д.'), upperInput.indexOf('E'), upperInput.indexOf('W'));
      if (latIndex !== -1 && lngIndex !== -1) {
        if (lngIndex < latIndex) {
          lat = parseFloat(matches[1]);
          lng = parseFloat(matches[0]);
        }
      }
    }
    
    if (upperInput.includes('Ю.Ш.') || upperInput.includes('S')) {
      lat = -Math.abs(lat);
    }
    if (upperInput.includes('З.Д.') || upperInput.includes('W')) {
      lng = -Math.abs(lng);
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    return [lat, lng];
  }

  selectPresetScale(preset: ScalePreset, event?: Event) {
    if (event) event.stopPropagation();
    this.mapScaleService.selectScale(preset, this.mapInstance);
    this.currentScale.set(preset.scale);
    this.isScaleMenuOpen.set(false);
  }

  toggleMeasurement() {
    this.tacticalMapService.interactionMode.set('edit');
    this.mapMeasurementService.toggleMeasurement(this.mapInstance);
  }

  resetBearing() {
    if (this.mapInstance) {
      this.mapInstance.resetNorth({ duration: 500 });
    }
  }

  setSidebarWidth(width: number) {
    const newWidth = Math.max(260, Math.min(700, width));
    this.sidebarWidth.set(newWidth);
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  toggleCategory(categoryId: string) {
    this.manuallyOpenedCategories.update(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }

  isCategoryOpen(categoryId: string): boolean {
    const query = this.symbolSearchQuery().trim();
    if (query.length > 0) {
      return true;
    }
    return !!this.manuallyOpenedCategories()[categoryId];
  }

  updateSearchQuery(query: string) {
    this.symbolsService.symbolSearchQuery.set(query);
  }

  updatePlacedSymbolSize(size: number) {
    this.tacticalMapService.updatePlacedSymbolSize(size);
  }

  updatePlacedSymbolAngle(angle: number) {
    this.tacticalMapService.updatePlacedSymbolAngle(angle);
  }

  async orientSelectedPlacedSymbolToTerrain() {
    const selected = this.selectedPlacedSymbol();
    if (selected && !selected.properties['isLinear']) {
      const coords = selected.geometry.coordinates;
      const bearing = await this.terrainService.getSlopeBearing(coords[0], coords[1]);
      if (bearing !== null) {
        this.updatePlacedSymbolAngle(bearing);
      }
    }
  }

  updatePlacedSymbolName(name: string) {
    this.tacticalMapService.updatePlacedSymbolName(name);
  }

  updatePlacedSymbolColor(color: string) {
    this.tacticalMapService.updatePlacedSymbolColor(color);
  }

  updatePlacedSymbolProperty(key: string, value: any) {
    this.tacticalMapService.updatePlacedSymbolProperty(key, value);
  }

  updateTemplateSize(size: number) {
    this.tacticalMapService.updateTemplateSize(size);
  }

  updateTemplateAngle(angle: number) {
    this.tacticalMapService.updateTemplateAngle(angle);
  }

  updateTemplateName(name: string) {
    this.tacticalMapService.updateTemplateName(name);
  }

  updateTemplateColor(color: string) {
    this.tacticalMapService.updateTemplateColor(color);
  }

  formatDuration(hours: number): string {
    if (!hours || isNaN(hours)) return '—';
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hrs > 0) {
      return `${hrs} ч ${mins} мин`;
    }
    return `${mins} мин`;
  }

  formatScale(scale: number): string {
    return scale.toLocaleString('ru-RU');
  }

  startPlayback() {
    const stats = this.selectedMarchRouteStats();
    if (stats) {
      this.playbackService.start(stats.totalDurationHrs);
    }
  }

  pausePlayback() {
    this.playbackService.pause();
  }

  resetPlayback() {
    this.playbackService.reset();
  }

  setPlaybackTime(timeHrs: number) {
    this.playbackService.currentTimeHrs.set(timeHrs);
  }

  setPlaybackSpeed(speed: number) {
    this.playbackService.speedMultiplier.set(speed);
  }

  readonly activeLineMode = signal<'none' | 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string>('none');
  readonly activeLineCoords = signal<[number, number][]>([]);
  readonly activeLineFlipSide = signal<boolean>(false);

  readonly activeLineModeDisplayName = computed(() => {
    const mode = this.activeLineMode();
    if (mode === 'trench') return 'Траншея';
    if (mode === 'comm_open') return 'Открытый ход сообщения';
    if (mode === 'comm_covered') return 'Крытый ход сообщения';
    if (mode === 'wire') return 'Колючая проволока (МЗП)';
    if (mode === 'point') return 'Точка (ориентир)';
    if (mode === 'arrow_attack') return 'Стрелка гл. удара';
    if (mode === 'arrow_supporting') return 'Стрелка вспом. удара';
    if (mode === 'arrow_retreat') return 'Стрелка отхода';
    if (mode === 'march_route') return 'Маршрут марша';
    return 'Линия';
  });

  selectSymbol(symbol: any) {
    if (symbol.id === 'trench_line' || symbol.id === 'wire_line' || symbol.id === 'comm_open_line' || symbol.id === 'comm_covered_line' || symbol.id === 'march_route' || (symbol.id && symbol.id.startsWith('arrow_'))) {
      this.tacticalMapService.clearSymbolSelection();
      let mode = 'wire';
      if (symbol.id === 'trench_line') mode = 'trench';
      else if (symbol.id === 'comm_open_line') mode = 'comm_open';
      else if (symbol.id === 'comm_covered_line') mode = 'comm_covered';
      else if (symbol.id === 'march_route') mode = 'march_route';
      else if (symbol.id && symbol.id.startsWith('arrow_')) mode = symbol.id;
      this.startDrawingLine(mode);
    } else {
      this.cancelDrawingLine();
      this.tacticalMapService.selectTemplateSymbol(symbol);
    }
  }

  startDrawingLine(mode: 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string) {
    this.tacticalMapService.interactionMode.set('edit');
    this.activeLineMode.set(mode);
    this.activeLineCoords.set([]);
    this.activeLineFlipSide.set(false);
  }

  placePointIcon(coords: [number, number]) {
    const color = '#ef4444'; // Изначально все заграждения и точки красного цвета
    const iconId = `tochka_c_${color.replace('#', '')}`;
    const newSymbol = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        symbol: 'tochka',
        iconId: iconId,
        color: color,
        name: 'Точка',
        size: 0.08,
        angle: 0
      },
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };

    const onReady = () => {
      this.tacticalMapService.placedSymbols.update(prev => [...prev, newSymbol]);
      this.tacticalMapService.updateTacticalSymbolsSource();
      this.tacticalMapService.selectPlacedSymbol(newSymbol);
    };

    this.tacticalMapService.ensureSymbolColorImageLoaded('tochka', color, onReady);
    this.cancelDrawingLine();
  }

  addDrawingPoint(coord: [number, number]) {
    if (this.activeLineMode() === 'none') return;
    if (this.activeLineMode() === 'point') {
      this.placePointIcon(coord);
      return;
    }
    this.activeLineCoords.update(prev => [...prev, coord]);
    this.updateDrawingPreview();
  }

  finishDrawingLine() {
    const mode = this.activeLineMode();
    const coords = this.activeLineCoords();
    if (mode !== 'none' && coords.length >= 2) {
      let name = 'Проволочное заграждение (МЗП)';
      if (mode === 'trench') name = 'Траншея (МО СССР)';
      else if (mode === 'comm_open') name = 'Открытый ход сообщения';
      else if (mode === 'comm_covered') name = 'Крытый ход сообщения (перекрытая щель)';
      else if (mode === 'arrow_attack') name = 'Стрелка главного удара';
      else if (mode === 'arrow_supporting') name = 'Стрелка вспомогательного удара';
      else if (mode === 'arrow_retreat') name = 'Стрелка отхода';
      else if (mode === 'march_route') name = 'Маршрут марша';
      this.tacticalMapService.placeLinearSymbol(coords, mode, name, this.activeLineFlipSide(), this.isLineSmooth());
    }
    this.cancelDrawingLine();
  }

  cancelDrawingLine() {
    this.activeLineMode.set('none');
    this.activeLineCoords.set([]);
    this.activeLineFlipSide.set(false);
    if (this.mapInstance) {
      const source = this.mapInstance.getSource('drawing-preview') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }

  toggleSelectionMode() {
    const mode = this.tacticalMapService.interactionMode();
    if (mode !== 'select') {
      this.cancelDrawingLine();
      if (this.isMeasuring() && this.mapInstance) {
        this.mapMeasurementService.cancelMeasurement(this.mapInstance);
      }
      this.tacticalMapService.interactionMode.set('select');
    } else {
      this.tacticalMapService.interactionMode.set('edit');
    }
  }

  toggleLinearSymbolSide() {
    if (this.activeLineMode() !== 'none') {
      this.activeLineFlipSide.update(v => !v);
    } else {
      this.tacticalMapService.toggleSelectedLinearSymbolSide();
    }
  }

  removeLastNodeOfSelectedLine() {
    const selected = this.selectedPlacedSymbol();
    if (selected && selected.properties?.['isLinear']) {
      const origCoords = selected.properties['origCoords'] as [number, number][];
      if (origCoords && origCoords.length > 2) {
        const newCoords = origCoords.slice(0, -1);
        this.tacticalMapService.updateLinearSymbolCoords(selected.properties['id'], newCoords);
      } else {
        this.deletePlacedSymbol();
      }
    }
  }

  continueDrawingSelectedLine() {
    const selected = this.selectedPlacedSymbol();
    if (selected && selected.properties?.['isLinear']) {
      const origCoords = selected.properties['origCoords'] as [number, number][];
      const lineType = selected.properties['lineType'];
      const flipSide = !!selected.properties['flipSide'];
      const isSmooth = !!selected.properties['isSmooth'];
      if (origCoords && origCoords.length >= 2) {
        this.tacticalMapService.deleteSelectedPlacedSymbol();
        this.activeLineFlipSide.set(flipSide);
        this.isLineSmooth.set(isSmooth);
        this.activeLineMode.set(lineType);
        this.activeLineCoords.set([...origCoords]);
        this.updateDrawingPreview();
      }
    }
  }

  removeDrawingLastPoint() {
    if (this.activeLineMode() === 'none') return;
    this.activeLineCoords.update(prev => prev.slice(0, -1));
    this.updateDrawingPreview();
  }

  updateDrawingPreview() {
    if (!this.mapInstance || this.activeLineMode() === 'none') return;
    const coords = this.activeLineCoords();
    if (coords.length < 1) return;

    const mode = this.activeLineMode();
    const previewColor = mode === 'wire' ? '#000000' : '#ef4444';

    if (!this.mapInstance.getSource('drawing-preview')) {
      this.mapInstance.addSource('drawing-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      this.mapInstance.addLayer({
        id: 'drawing-preview-layer',
        type: 'line',
        source: 'drawing-preview',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': previewColor,
          'line-width': 3.5,
          'line-dasharray': [2, 2]
        }
      });
    }

    const source = this.mapInstance.getSource('drawing-preview') as maplibregl.GeoJSONSource;
    if (source && coords.length >= 2) {
      let previewCoords = coords;
      if (this.isLineSmooth() && coords.length >= 3) {
        previewCoords = this.tacticalMapService.trenchGeometryService.interpolateCatmullRom(coords, 12);
      }
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: previewCoords }
        }]
      });
    }

    if (this.mapInstance.getLayer('drawing-preview-layer')) {
      this.mapInstance.setPaintProperty('drawing-preview-layer', 'line-color', previewColor);
    }
  }

  deletePlacedSymbol() {
    this.tacticalMapService.deleteSelectedPlacedSymbol();
  }

  toggleQuickLayer(groupId: string) {
    this.onQuickLayerToggle(groupId);
  }

  onZoomPercentInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/[^0-9%]/g, '');
    if (val.includes('%')) {
      val = val.replace(/%/g, '') + '%';
    }
    input.value = val;
  }

  onZoomPercentKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const input = event.target as HTMLInputElement;
      this.applyPercentText(input.value, input);
      input.blur();
    }
  }

  onZoomPercentBlur(event: Event) {
    const input = event.target as HTMLInputElement;
    this.applyPercentText(input.value, input);
  }

  private applyPercentText(text: string, inputElement: HTMLInputElement) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (!digitsOnly) {
      const zoom = this.zoomLevel();
      const percent = Math.round(100 * Math.pow(2, zoom - 13.2));
      inputElement.value = `${percent}%`;
      return;
    }
    
    let percent = parseInt(digitsOnly, 10);
    percent = Math.max(1, Math.min(2800, percent));
    this.applyZoomPercent(percent);
  }

  applyZoomPercent(percent: number) {
    const zoom = 13.2 + Math.log2(percent / 100);
    const clampedZoom = Math.max(6.48, Math.min(18, zoom));
    
    if (this.mapInstance) {
      this.mapInstance.zoomTo(clampedZoom, { duration: 300 });
    }
  }

  adjustZoomPercent(delta: number) {
    const zoom = this.zoomLevel();
    const currentPercent = Math.round(100 * Math.pow(2, zoom - 13.2));
    let newPercent;
    if (delta > 0) {
      newPercent = Math.ceil((currentPercent + 0.1) / 10) * 10;
    } else {
      newPercent = Math.floor((currentPercent - 0.1) / 10) * 10;
    }
    newPercent = Math.max(1, Math.min(2800, newPercent));
    this.applyZoomPercent(newPercent);
  }
}
