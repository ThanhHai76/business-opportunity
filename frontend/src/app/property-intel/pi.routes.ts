import { Routes } from '@angular/router';
import { PiShellComponent } from './shell/pi-shell.component';

export const PROPERTY_INTEL_ROUTES: Routes = [
  {
    path: '',
    component: PiShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'AI Property Intelligence',
        loadComponent: () => import('./pages/hero/pi-hero.component').then((m) => m.PiHeroComponent),
      },
      {
        path: 'map',
        title: 'Map Intelligence · AI Property Intelligence',
        loadComponent: () => import('./pages/dashboard/pi-dashboard.component').then((m) => m.PiDashboardComponent),
      },
      {
        path: 'projects/:slug',
        title: 'Project · AI Property Intelligence',
        loadComponent: () => import('./pages/project/pi-project.component').then((m) => m.PiProjectComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
