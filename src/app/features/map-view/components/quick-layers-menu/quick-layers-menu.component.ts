import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-quick-layers-menu',
  standalone: true,
  templateUrl: './quick-layers-menu.component.html',
  styleUrl: './quick-layers-menu.component.css'
})
export class QuickLayersMenuComponent {
  readonly vm = inject(MapViewModel);

  isGroupActive(groupId: string): boolean {
    if (groupId === 'elevation') {
      const elevationGroup = this.vm.layerGroups().find(g => g.id === 'elevation');
      return elevationGroup?.layers.some(l => l.visible) ?? false;
    }
    const group = this.vm.layerGroups().find(g => g.id === groupId);
    return group?.layers.some(l => l.visible) ?? false;
  }
}
