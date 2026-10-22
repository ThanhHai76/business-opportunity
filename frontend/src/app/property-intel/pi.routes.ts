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
        title: 'Chấm điểm bất động sản · Hanoi Century Vista',
        loadComponent: () => import('./pages/hero/pi-hero.component').then((m) => m.PiHeroComponent),
      },
      {
        path: 'map',
        title: 'Bản đồ phân tích · Chấm điểm bất động sản',
        loadComponent: () => import('./pages/dashboard/pi-dashboard.component').then((m) => m.PiDashboardComponent),
      },
      {
        path: 'projects/:slug',
        title: 'Dự án · Chấm điểm bất động sản',
        loadComponent: () => import('./pages/project/pi-project.component').then((m) => m.PiProjectComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
