import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Hanoi 100 Years',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'opportunity-map',
    title: 'Business Opportunity Map',
    loadComponent: () =>
      import('./opportunity/opportunity.component').then((m) => m.OpportunityComponent),
  },
  {
    path: 'time-machine',
    title: 'Hanoi Time Machine',
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
    title: 'Hanoi Future Map',
    loadComponent: () => import('./future-map/future-map.component').then((m) => m.FutureMapComponent),
  },
  // The Business Copilot was merged into the Business Opportunity Map: every old link lands there.
  { path: 'business-copilot', pathMatch: 'full', redirectTo: 'opportunity-map' },
  { path: 'business-copilot', children: [{ path: '**', redirectTo: '/opportunity-map' }] },
  {
    path: 'property-intelligence',
    loadChildren: () => import('./property-intel/pi.routes').then((m) => m.PROPERTY_INTEL_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
