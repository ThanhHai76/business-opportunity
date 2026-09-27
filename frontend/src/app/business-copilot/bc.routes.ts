import { Routes } from '@angular/router';
import { BcShellComponent } from './shell/bc-shell.component';

export const BUSINESS_COPILOT_ROUTES: Routes = [
  {
    path: '',
    component: BcShellComponent,
    children: [
      { path: '', pathMatch: 'full', title: 'Hanoi Business Copilot', loadComponent: () => import('./pages/dashboard.component').then((m) => m.BcDashboardComponent) },
      { path: 'explore', title: 'Explore · Business Copilot', loadComponent: () => import('./pages/explore.component').then((m) => m.BcExploreComponent) },
      { path: 'market', title: 'Market Data · Business Copilot', loadComponent: () => import('./pages/market.component').then((m) => m.BcMarketComponent) },
      { path: 'competitors', title: 'Competitors · Business Copilot', loadComponent: () => import('./pages/market.component').then((m) => m.BcCompetitorsComponent) },
      { path: 'compare', title: 'Compare · Business Copilot', loadComponent: () => import('./pages/compare.component').then((m) => m.BcCompareComponent) },
      { path: 'simulator', title: 'Simulator · Business Copilot', loadComponent: () => import('./pages/simulator.component').then((m) => m.BcSimulatorComponent) },
      { path: 'reports', title: 'Reports · Business Copilot', loadComponent: () => import('./pages/reports.component').then((m) => m.BcReportsComponent) },
      { path: 'copilot', title: 'AI Copilot · Business Copilot', loadComponent: () => import('./pages/reports.component').then((m) => m.BcCopilotPageComponent) },
      { path: 'location/:slug', title: 'Location Intelligence · Business Copilot', loadComponent: () => import('./pages/location.component').then((m) => m.BcLocationComponent) },
      { path: '**', redirectTo: '' },
    ],
  },
];
