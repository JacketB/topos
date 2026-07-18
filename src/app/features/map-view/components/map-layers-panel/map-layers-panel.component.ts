import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ObjectGroup } from '../../services/tactical-map.service';

@Component({
  selector: 'app-map-layers-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-layers-panel.component.html',
  styleUrl: './map-layers-panel.component.css'
})
export class MapLayersPanelComponent {
  readonly vm = inject(MapViewModel);

  // Локальные сигналы для UI
  newGroupName = signal<string>('');
  isCreatingGroup = signal<boolean>(false);
  selectedTargetGroupId = signal<string>('');
  
  // Чекбоксы для ручной группировки в списке
  checkedElementIds = signal<Record<number, boolean>>({});

  toggleElementCheck(id: number) {
    this.checkedElementIds.update(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  getCheckedIdsList(): number[] {
    const record = this.checkedElementIds();
    return Object.keys(record)
      .map(Number)
      .filter(id => record[id]);
  }

  onCreateGroup() {
    const name = this.newGroupName().trim();
    if (!name) return;
    const group = this.vm.tacticalMapService.createGroup(name);
    this.newGroupName.set('');
    this.isCreatingGroup.set(false);
    
    // Если есть выделенные чекбоксы, сразу переносим их в созданную группу
    const checked = this.getCheckedIdsList();
    if (checked.length > 0) {
      this.vm.tacticalMapService.addElementsToGroup(group.id, checked);
      this.checkedElementIds.set({});
    }
  }

  onDeleteGroup(groupId: string, event: MouseEvent) {
    event.stopPropagation();
    if (confirm('Вы уверены, что хотите удалить этот район? Объекты не будут удалены с карты.')) {
      this.vm.tacticalMapService.deleteGroup(groupId);
    }
  }

  onRenameGroup(groupId: string, event: MouseEvent) {
    event.stopPropagation();
    const group = this.vm.objectGroups().find((g: any) => g.id === groupId);
    if (!group) return;
    const newName = prompt('Введите новое имя района:', group.name);
    if (newName && newName.trim()) {
      this.vm.tacticalMapService.renameGroup(groupId, newName.trim());
    }
  }

  // Добавление отмеченных чекбоксами элементов в группу
  addCheckedToGroup(groupId: string) {
    if (!groupId) return;
    const checked = this.getCheckedIdsList();
    if (checked.length > 0) {
      this.vm.tacticalMapService.addElementsToGroup(groupId, checked);
      this.checkedElementIds.set({});
    }
  }

  // Добавление выделенных на карте элементов в выбранную группу
  addSelectedOnMapToGroup(groupId: string) {
    if (!groupId) return;
    const selectedIds = this.vm.selectedPlacedSymbols().map((s: any) => s.properties.id);
    if (selectedIds.length > 0) {
      this.vm.tacticalMapService.addElementsToGroup(groupId, selectedIds);
      // Сбрасываем выбор на карте
      this.vm.tacticalMapService.selectedPlacedSymbols.set([]);
      this.vm.tacticalMapService.selectedPlacedSymbol.set(null);
    }
  }

  removeElementFromGroup(groupId: string, elementId: number, event: MouseEvent) {
    event.stopPropagation();
    this.vm.tacticalMapService.removeElementsFromGroup(groupId, [elementId]);
  }

  selectElement(element: any) {
    this.vm.tacticalMapService.selectPlacedSymbol(element);
    // Отцентруем карту на координатах объекта, если есть инстанс карты
    const map = (this.vm as any).mapInstance || (this.vm.tacticalMapService as any).mapInstance;
    if (map && element.geometry) {
      let coords: [number, number] | null = null;
      if (element.geometry.type === 'Point') {
        coords = element.geometry.coordinates;
      } else if (element.geometry.type === 'LineString') {
        coords = element.geometry.coordinates[0];
      }
      if (coords) {
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 800 });
      }
    }
  }

  // Получить объект по ID
  findElementById(id: number): any {
    return this.vm.placedSymbols().find((s: any) => s.properties?.id === id);
  }

  // Получить список несгруппированных объектов
  getUngroupedElements(): any[] {
    const placed = this.vm.placedSymbols();
    const groups = this.vm.objectGroups();
    const groupedIds = new Set<number>();
    groups.forEach((g: any) => g.elementIds.forEach((id: any) => groupedIds.add(id)));
    return placed.filter((s: any) => !groupedIds.has(s.properties?.id));
  }

  getSymbolName(s: any): string {
    if (s.properties?.name) return s.properties.name;
    if (s.properties?.isLinear) {
      if (s.properties.lineType === 'trench') return 'Траншея';
      if (s.properties.lineType === 'comm_open') return 'Открытый ход сообщения';
      if (s.properties.lineType === 'comm_covered') return 'Крытый ход сообщения';
      if (s.properties.lineType === 'wire') return 'Проволочное заграждение';
      return 'Линейный объект';
    }
    return 'Точечный объект';
  }
}
