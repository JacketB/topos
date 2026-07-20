import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-district-summary-modal',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  templateUrl: './district-summary-modal.component.html',
  styleUrl: './district-summary-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DistrictSummaryModalComponent {
  readonly vm = inject(MapViewModel);
}
