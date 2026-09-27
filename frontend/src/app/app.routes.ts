import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'opportunity-map',
    loadComponent: () =>
      import('./pages/opportunity-map/opportunity-map.component').then(
        (m) => m.OpportunityMapPageComponent
      ),
  },
  {
    path: 'time-machine',
    loadComponent: () =>
      import('./pages/time-machine/time-machine.component').then(
        (m) => m.TimeMachineComponent
      ),
  },
  {
    path: 'living-score',
    loadChildren: () => import('./living-score/living-score.routes').then((m) => m.LIVING_SCORE_ROUTES),
  },
  {
    path: 'future-map',
    loadComponent: () => import('./future-map/future-map.component').then((m) => m.FutureMapComponent),
  },
  {
    path: 'business-copilot',
    loadChildren: () => import('./business-copilot/bc.routes').then((m) => m.BUSINESS_COPILOT_ROUTES),
  },
  {
    path: 'property-intelligence',
    loadChildren: () => import('./property-intel/pi.routes').then((m) => m.PROPERTY_INTEL_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
