import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { CRITERION_ICONS } from '../../living-score.constants';
import { AreaSummary } from '../../models/living-score.models';
import { MillionsPipe } from '../../pipes/format.pipes';
import { LivingMetaService } from '../../services/living-meta.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';

@Component({
  selector: 'app-living-landing',
  standalone: true,
  imports: [DecimalPipe, RouterLink, IconComponent, ScoreRingComponent, StateMessageComponent, MillionsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  protected readonly meta = inject(LivingMetaService);
  protected readonly icons = CRITERION_ICONS;

  protected readonly areas = signal<AreaSummary[] | null>(null);
  protected readonly error = signal('');

  protected readonly features = [
    {
      icon: 'map',
      title: 'Bản đồ tương tác',
      text: 'Xem Living Score ngay trên bản đồ, lọc theo giao thông, trường học, bệnh viện, công viên… và bật lớp metro, hạ tầng tương lai.',
      link: '/living-score/explore',
      cta: 'Mở bản đồ',
    },
    {
      icon: 'scale',
      title: 'So sánh khu vực',
      text: 'Đặt 2–3 khu vực cạnh nhau bằng bảng và biểu đồ radar để thấy rõ ưu, nhược điểm từng nơi.',
      link: '/living-score/compare',
      cta: 'So sánh ngay',
    },
    {
      icon: 'sparkles',
      title: 'AI gợi ý cá nhân hoá',
      text: 'Nhập ngân sách, nơi làm việc, gia đình và ưu tiên — nhận Top 3 khu vực phù hợp kèm lý do cụ thể.',
      link: '/living-score/ai',
      cta: 'Nhận gợi ý',
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    this.api.areas({ sort: 'score' }).subscribe({
      next: (result) => this.areas.set(result.data),
      error: (e: unknown) => this.error.set(describeApiError(e)),
    });
  }
}
