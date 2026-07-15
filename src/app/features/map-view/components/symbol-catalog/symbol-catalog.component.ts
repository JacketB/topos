import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-symbol-catalog',
  standalone: true,
  templateUrl: './symbol-catalog.component.html',
  styleUrl: './symbol-catalog.component.css'
})
export class SymbolCatalogComponent {
  readonly vm = inject(MapViewModel);

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateSearchQuery(input.value);
  }

  onSymbolCategoryToggle(categoryId: string, event: Event) {
    const details = event.target as HTMLDetailsElement;
    if (details) {
      const isOpen = details.open;
      const currentlyOpen = this.vm.isCategoryOpen(categoryId);
      if (isOpen !== currentlyOpen) {
        this.vm.toggleCategory(categoryId);
      }
    }
  }

  onSymbolClick(template: any) {
    this.vm.tacticalMapService.selectTemplateSymbol(template);
  }
}
