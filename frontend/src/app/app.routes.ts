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
  { path: '**', redirectTo: '' },
];
