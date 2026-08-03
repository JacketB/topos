import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { MarchRouteService, BelarusPlace, ColumnType, MarchRoute } from '../../services/march-route.service';
import { PlaceSearchComponent } from '../place-search/place-search.component';

export interface RoutePointItem {
  id: string;
  label: string;
  name: string;
  coords: [number, number] | null;
  type: 'origin' | 'waypoint' | 'destination';
}

@Component({
  selector: 'app-route-planner-panel',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, PlaceSearchComponent],
  templateUrl: './route-planner-panel.component.html',
  styleUrls: ['./route-planner-panel.component.css']
})
export class RoutePlannerPanelComponent {
  readonly vm = inject(MapViewModel);
  private routeService = inject(MarchRouteService);

  isOpen = this.vm.isRoutePlannerOpen;
  activeColumnType = this.vm.activeColumnType;
  isNightMarch = this.vm.isNightMarch;
  originPoint = this.vm.originPoint;
  destinationPoint = this.vm.destinationPoint;
  waypoints = this.vm.waypoints;
  calculatedRoute = this.vm.calculatedRoute;
  isCalculating = signal<boolean>(false);

  togglePanel() {
    this.vm.toggleRoutePlanner();
  }

  setColumnType(type: ColumnType) {
    this.activeColumnType.set(type);
    this.recalculateRoute();
  }

  toggleNightMarch() {
    this.isNightMarch.update(v => !v);
    this.recalculateRoute();
  }

  onOriginSelected(place: BelarusPlace) {
    this.originPoint.update(p => ({ ...p, name: place.name, coords: place.coords }));
    this.vm.moveToCoordinates(place.coords[1], place.coords[0]);
    this.recalculateRoute();
  }

  onDestinationSelected(place: BelarusPlace) {
    this.destinationPoint.update(p => ({ ...p, name: place.name, coords: place.coords }));
    this.vm.moveToCoordinates(place.coords[1], place.coords[0]);
    this.recalculateRoute();
  }

  addWaypoint() {
    const newId = `wp_${Date.now()}`;
    const count = this.waypoints().length + 1;
    this.waypoints.update(list => [
      ...list,
      {
        id: newId,
        label: `ПР${count}`,
        name: `Пункт регулирования ${count}`,
        coords: null,
        type: 'waypoint'
      }
    ]);
  }

  onWaypointSelected(index: number, place: BelarusPlace) {
    this.waypoints.update(list => {
      const updated = [...list];
      if (updated[index]) {
        updated[index] = { ...updated[index], name: place.name, coords: place.coords };
      }
      return updated;
    });
    this.vm.moveToCoordinates(place.coords[1], place.coords[0]);
    this.recalculateRoute();
  }

  removeWaypoint(index: number) {
    this.waypoints.update(list => list.filter((_, i) => i !== index));
    this.recalculateRoute();
  }

  swapOriginDestination() {
    const orig = this.originPoint();
    const dest = this.destinationPoint();

    this.originPoint.set({ ...dest, id: 'origin', label: 'A', type: 'origin' });
    this.destinationPoint.set({ ...orig, id: 'destination', label: 'B', type: 'destination' });
    this.recalculateRoute();
  }

  async recalculateRoute() {
    const orig = this.originPoint().coords;
    const dest = this.destinationPoint().coords;

    if (!orig || !dest) return;

    const wpCoords = this.waypoints()
      .map(w => w.coords)
      .filter((c): c is [number, number] => c !== null);

    this.isCalculating.set(true);
    try {
      const res = await this.routeService.calculateGraphRoute(
        orig,
        dest,
        wpCoords,
        this.activeColumnType()
      );

      this.calculatedRoute.set(res.routeStats);
      this.vm.drawMarchRouteOnMap(res.coordinates, res.routeStats);
    } catch {
      this.calculatedRoute.set(null);
    } finally {
      this.isCalculating.set(false);
    }
  }

  openMarchOrderScheme() {
    if (this.calculatedRoute()) {
      this.vm.openMarchOrderWithStats(this.calculatedRoute()!);
    }
  }

  onClearRoute() {
    this.vm.clearMarchRoute();
  }
}
