import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
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

  onPlaceSelected(place: BelarusPlace) {
    if (place && place.coords) {
      this.vm.moveToCoordinates(place.coords[1], place.coords[0]);
    }
  }
}
