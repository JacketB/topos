import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-march-route-modal',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './march-route-modal.component.html',
  styleUrl: './march-route-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarchRouteModalComponent {
  readonly vm = inject(MapViewModel);

  onMarchColumnChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.vm.marchColumnType.set(select.value as any);
    }
  }

  onMarchNightChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox) {
      this.vm.marchIsNight.set(checkbox.checked);
    }
  }

  onTogglePlayback() {
    if (this.vm.isPlayingPlayback()) {
      this.vm.pausePlayback();
    } else {
      this.vm.startPlayback();
    }
  }

  onResetPlayback() {
    this.vm.resetPlayback();
  }

  onPlaybackTimelineChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.setPlaybackTime(parseFloat(input.value));
  }

  onPlaybackSpeedChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.setPlaybackSpeed(parseInt(select.value, 10));
  }
}
