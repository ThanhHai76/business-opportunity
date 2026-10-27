import { Routes } from '@angular/router';

/** The career page is in Vietnamese and English: its title follows the language in the address or the one remembered (the key of the Business Opportunity Map). */
function careerTitle(): string {
  try {
    const lang = new URLSearchParams(location.search).get('lang') ?? localStorage.getItem('hanoi100.lang') ?? localStorage.getItem('hanoi100.op.lang');
    if (lang === 'en') return 'Hanoi Career Compass · Hanoi Century Vista';
  } catch {
    /* no address or storage: Vietnamese */
  }
  return 'La bàn nghề nghiệp Hà Nội · Hanoi Century Vista';
}

export const routes: Routes = [
  {
    path: '',
    title: 'Hanoi Century Vista',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'opportunity-map',
    title: 'Mở gì ở đâu · Hanoi Century Vista',
    loadComponent: () =>
      import('./opportunity/opportunity.component').then((m) => m.OpportunityComponent),
  },
  {
    path: 'time-machine',
    title: 'Hà Nội xưa và nay · Hanoi Century Vista',
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
    title: 'Hà Nội tương lai · Hanoi Century Vista',
    loadComponent: () => import('./future-map/future-map.component').then((m) => m.FutureMapComponent),
  },
  {
    path: 'career',
    title: careerTitle,
    loadComponent: () => import('./career/career.component').then((m) => m.CareerComponent),
  },
  // The Business Copilot was merged into the Business Opportunity Map: every old link lands there.
  { path: 'business-copilot', pathMatch: 'full', redirectTo: 'opportunity-map' },
  { path: 'business-copilot', children: [{ path: '**', redirectTo: '/opportunity-map' }] },
  {
    path: 'premium',
    title: 'Premium · Hanoi Century Vista',
    loadComponent: () => import('./pages/premium/premium.component').then((m) => m.PremiumComponent),
  },
  {
    path: 'property-intelligence',
    loadChildren: () => import('./property-intel/pi.routes').then((m) => m.PROPERTY_INTEL_ROUTES),
  },
  { path: 'terms', title: 'Điều khoản sử dụng · Hanoi Century Vista', data: { kind: 'terms' }, loadComponent: () => import('./pages/legal/legal.component').then((m) => m.LegalComponent) },
  { path: 'privacy', title: 'Quyền riêng tư · Hanoi Century Vista', data: { kind: 'privacy' }, loadComponent: () => import('./pages/legal/legal.component').then((m) => m.LegalComponent) },
  { path: 'refund', title: 'Chính sách hoàn tiền · Hanoi Century Vista', data: { kind: 'refund' }, loadComponent: () => import('./pages/legal/legal.component').then((m) => m.LegalComponent) },
  { path: 'forgot-password', title: 'Quên mật khẩu · Hanoi Century Vista', data: { mode: 'forgot' }, loadComponent: () => import('./pages/auth-link/auth-link.component').then((m) => m.AuthLinkComponent) },
  { path: 'reset-password', title: 'Đặt mật khẩu mới · Hanoi Century Vista', data: { mode: 'reset' }, loadComponent: () => import('./pages/auth-link/auth-link.component').then((m) => m.AuthLinkComponent) },
  { path: 'verify-email', title: 'Xác minh email · Hanoi Century Vista', data: { mode: 'verify' }, loadComponent: () => import('./pages/auth-link/auth-link.component').then((m) => m.AuthLinkComponent) },
  { path: '**', redirectTo: '' },
];
