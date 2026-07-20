import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-map-toolbar',
  standalone: true,
  imports: [],
  templateUrl: './map-toolbar.component.html',
  styleUrl: './map-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapToolbarComponent {
  readonly vm = inject(MapViewModel);
}
