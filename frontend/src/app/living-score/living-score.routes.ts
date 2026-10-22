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
        title: 'Điểm đáng sống · Hanoi Century Vista',
        loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent),
      },
      {
        path: 'explore',
        title: 'Khám phá · Điểm đáng sống',
        loadComponent: () => import('./pages/explore/explore.component').then((m) => m.ExploreComponent),
      },
      {
        path: 'area/:slug',
        title: 'Chi tiết khu vực · Điểm đáng sống',
        loadComponent: () => import('./pages/area-detail/area-detail.component').then((m) => m.AreaDetailComponent),
      },
      {
        path: 'compare',
        title: 'So sánh · Điểm đáng sống',
        loadComponent: () => import('./pages/compare/compare.component').then((m) => m.CompareComponent),
      },
      {
        path: 'ai',
        title: 'AI gợi ý · Điểm đáng sống',
        loadComponent: () => import('./pages/ai-recommend/ai-recommend.component').then((m) => m.AiRecommendComponent),
      },
      {
        path: 'saved',
        title: 'Đã lưu · Điểm đáng sống',
        loadComponent: () => import('./pages/saved/saved.component').then((m) => m.SavedComponent),
      },
      {
        path: 'profile',
        title: 'Cá nhân · Điểm đáng sống',
        loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
