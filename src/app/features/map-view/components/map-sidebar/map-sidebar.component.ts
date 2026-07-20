import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { SymbolPropertiesComponent } from '../symbol-properties/symbol-properties.component';

@Component({
  selector: 'app-map-sidebar',
  standalone: true,
  imports: [SymbolPropertiesComponent],
  templateUrl: './map-sidebar.component.html',
  styleUrl: './map-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapSidebarComponent {
  readonly vm = inject(MapViewModel);

  onStartResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.vm.sidebarWidth();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      this.vm.setSidebarWidth(startWidth + deltaX);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this.vm.getMapInstance()) {
        this.vm.getMapInstance()?.resize();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
