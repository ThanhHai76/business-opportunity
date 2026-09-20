import { Routes } from '@angular/router';
import { LivingShellComponent } from './shell/living-shell.component';

export const LIVING_SCORE_ROUTES: Routes = [
  {
    path: '',
    component: LivingShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Hanoi Living Score',
        loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent),
      },
      {
        path: 'explore',
        title: 'Khám phá · Hanoi Living Score',
        loadComponent: () => import('./pages/explore/explore.component').then((m) => m.ExploreComponent),
      },
      {
        path: 'area/:slug',
        title: 'Chi tiết khu vực · Hanoi Living Score',
        loadComponent: () => import('./pages/area-detail/area-detail.component').then((m) => m.AreaDetailComponent),
      },
      {
        path: 'compare',
        title: 'So sánh · Hanoi Living Score',
        loadComponent: () => import('./pages/compare/compare.component').then((m) => m.CompareComponent),
      },
      {
        path: 'ai',
        title: 'AI gợi ý · Hanoi Living Score',
        loadComponent: () => import('./pages/ai-recommend/ai-recommend.component').then((m) => m.AiRecommendComponent),
      },
      {
        path: 'saved',
        title: 'Đã lưu · Hanoi Living Score',
        loadComponent: () => import('./pages/saved/saved.component').then((m) => m.SavedComponent),
      },
      {
        path: 'profile',
        title: 'Cá nhân · Hanoi Living Score',
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
