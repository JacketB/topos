import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation, signal, HostListener } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { PlaceSearchComponent } from '../place-search/place-search.component';
import { BelarusPlace } from '../../services/march-route.service';

@Component({
  selector: 'app-map-toolbar',
  standalone: true,
  imports: [PlaceSearchComponent],
  templateUrl: './map-toolbar.component.html',
  styleUrl: './map-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapToolbarComponent {
  readonly vm = inject(MapViewModel);

  readonly isLinesMenuOpen = signal<boolean>(false);
  readonly isArrowsMenuOpen = signal<boolean>(false);
  readonly isAnalyticsMenuOpen = signal<boolean>(false);

  toggleLinesMenu(event?: Event) {
    event?.stopPropagation();
    const current = this.isLinesMenuOpen();
    this.closeAllSubmenus();
    this.isLinesMenuOpen.set(!current);
  }

  toggleArrowsMenu(event?: Event) {
    event?.stopPropagation();
    const current = this.isArrowsMenuOpen();
    this.closeAllSubmenus();
    this.isArrowsMenuOpen.set(!current);
  }

  toggleAnalyticsMenu(event?: Event) {
    event?.stopPropagation();
    const current = this.isAnalyticsMenuOpen();
    this.closeAllSubmenus();
    this.isAnalyticsMenuOpen.set(!current);
  }

  closeAllSubmenus() {
    this.isLinesMenuOpen.set(false);
    this.isArrowsMenuOpen.set(false);
    this.isAnalyticsMenuOpen.set(false);
  }

  selectLineMode(mode: string) {
    if (this.vm.activeLineMode() === mode) {
      this.vm.cancelDrawingLine();
    } else {
      this.vm.startDrawingLine(mode);
    }
    this.isLinesMenuOpen.set(false);
  }

  toggleLineMode() {
    if (this.vm.activeLineMode() === 'simple_line' || this.vm.activeLineMode() === 'line') {
      this.vm.cancelDrawingLine();
    } else {
      this.vm.startDrawingLine('simple_line');
    }
    this.closeAllSubmenus();
  }

  selectArrowMode(mode: string) {
    if (this.vm.activeLineMode() === mode) {
      this.vm.cancelDrawingLine();
    } else {
      this.vm.startDrawingLine(mode);
    }
    this.isArrowsMenuOpen.set(false);
  }

  toggleAreaMode() {
    if (this.vm.activeLineMode() === 'area_polygon' || this.vm.activeLineMode() === 'area') {
      this.vm.cancelDrawingLine();
    } else {
      this.vm.startDrawingLine('area_polygon');
    }
    this.closeAllSubmenus();
  }

  selectTextMode() {
    if (this.vm.activeLineMode() === 'text_box') {
      this.vm.cancelDrawingLine();
    } else {
      this.vm.startDrawingLine('text_box');
    }
    this.closeAllSubmenus();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeAllSubmenus();
  }

  onPlaceSelected(place: BelarusPlace) {
    if (place && place.coords) {
      this.vm.moveToCoordinates(place.coords[1], place.coords[0]);
    }
  }

  onSymbolSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const query = input.value;
    this.vm.symbolsService.symbolSearchQuery.set(query);
    const groups = this.vm.symbolsService.groupedSymbols();
    if (groups.length > 0) {
      const currentCat = this.vm.selectedSymbolCategory();
      if (!groups.some(g => g.id === currentCat)) {
        this.vm.selectedSymbolCategory.set(groups[0].id);
      }
    }
  }
}
