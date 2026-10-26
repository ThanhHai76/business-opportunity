import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { LegalLinksComponent } from '../legal/legal-links.component';
import { HeroSkylineComponent } from './hero-skyline.component';

/** What a visitor may want, and the tool that answers it (the quick start under the title of the home page). */
export interface Intent {
  id: string;
  icon: string;
  /** In the visitor's words. */
  want: string;
  /** What they will see. */
  tool: string;
  path: string;
  query?: Record<string, string>;
  accent: 'biz' | 'career' | 'property' | 'live' | 'future' | 'time';
}

export const INTENTS: Intent[] = [
  { id: 'shop', icon: '☕', want: 'Tôi muốn mở quán hoặc cửa hàng', tool: 'Mở gì ở đâu · phường nào hợp, có lời không', path: '/opportunity-map', accent: 'biz' },
  { id: 'job', icon: '💼', want: 'Tôi muốn tìm hướng nghề hoặc việc làm', tool: 'La bàn nghề nghiệp · 5 câu hỏi, kế hoạch 30 ngày', path: '/career', accent: 'career' },
  { id: 'home', icon: '🏠', want: 'Tôi muốn chọn nơi sống', tool: 'Điểm đáng sống · hợp với điều bạn quan tâm', path: '/living-score', accent: 'live' },
  { id: 'invest', icon: '📈', want: 'Tôi cân nhắc mua nhà hoặc đầu tư', tool: 'Chấm điểm bất động sản · tiềm năng từng phường', path: '/property-intelligence', accent: 'property' },
  { id: 'future', icon: '🛰️', want: 'Tôi muốn biết Hà Nội sẽ ra sao', tool: 'Hà Nội tương lai · quy hoạch đến 2065', path: '/future-map', accent: 'future' },
  { id: 'past', icon: '🏛️', want: 'Tôi tò mò về Hà Nội xưa', tool: 'Hà Nội xưa và nay · kể chuyện theo từng nơi', path: '/time-machine', accent: 'time' },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent, HeroSkylineComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly account = inject(AccountService);
  protected readonly billing = inject(BillingService);
  protected readonly intents = INTENTS;
}
