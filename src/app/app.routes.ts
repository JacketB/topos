import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/map-view/map-view').then(m => m.MapView)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
