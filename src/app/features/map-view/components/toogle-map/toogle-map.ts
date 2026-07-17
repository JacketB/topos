import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { mapsUrls } from '../../../../consts/map-urls';

@Component({
  selector: 'app-toogle-map',
  standalone: true,
  templateUrl: './toogle-map.html',
  styleUrl: './toogle-map.css',
})
export class ToogleMap {
  readonly vm = inject(MapViewModel);
  readonly mapsUrls = mapsUrls;

  toggleMenu() {
    this.vm.toggleToogleMapMenu();
  }

  selectMap(mapId: string) {
    this.vm.activeMapId.set(mapId);
    this.vm.isToogleMapMenuOpen.set(false);
  }

  getMapKeys(): string[] {
    return Object.keys(this.mapsUrls);
  }
}
