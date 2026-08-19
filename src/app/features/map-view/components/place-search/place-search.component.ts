import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarchRouteService, BelarusPlace } from '../../services/march-route.service';

@Component({
  selector: 'app-place-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './place-search.component.html',
  styleUrls: ['./place-search.component.css']
})
export class PlaceSearchComponent {
  private routeService = inject(MarchRouteService);

  @Output() selectPlace = new EventEmitter<BelarusPlace>();

  searchQuery = signal('');
  searchResults = signal<BelarusPlace[]>([]);
  isOpen = signal(false);
  isLoading = signal(false);

  async onInput(query: string) {
    this.searchQuery.set(query);
    if (!query.trim()) {
      this.searchResults.set([]);
      this.isOpen.set(false);
      return;
    }

    this.isLoading.set(true);
    this.isOpen.set(true);
    try {
      const res = await this.routeService.searchPlaces(query);
      this.searchResults.set(res);
    } catch {
      this.searchResults.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSelect(place: BelarusPlace) {
    this.selectPlace.emit(place);
    this.searchQuery.set(place.name);
    this.isOpen.set(false);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.isOpen.set(false);
  }
}
