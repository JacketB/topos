import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-toogle-map',
  imports: [],
  templateUrl: './toogle-map.html',
  styleUrl: './toogle-map.css',
})
export class ToogleMap {
  readonly vm = inject(MapViewModel);
}
