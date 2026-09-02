import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/projects-view/projects-view').then(m => m.ProjectsView)
  },
  {
    path: 'projects',
    loadComponent: () => import('./features/projects-view/projects-view').then(m => m.ProjectsView)
  },
  {
    path: 'map',
    loadComponent: () => import('./features/map-view/map-view').then(m => m.MapView)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
