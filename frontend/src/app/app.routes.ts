import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
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
  { path: '**', redirectTo: '' },
];
