import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../components/icon/icon.component';
import { ScoreRingComponent } from '../../components/score-ring/score-ring.component';
import { StateMessageComponent } from '../../components/state-message/state-message.component';
import { CRITERION_ICONS } from '../../living-score.constants';
import { AreaSummary } from '../../models/living-score.models';
import { FactsPipe } from '../../pipes/format.pipes';
import { LangService } from '../../services/lang.service';
import { LivingMetaService } from '../../services/living-meta.service';
import { LivingScoreApiService, describeApiError } from '../../services/living-score-api.service';

@Component({
  selector: 'app-living-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, ScoreRingComponent, StateMessageComponent, FactsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly api = inject(LivingScoreApiService);
  protected readonly meta = inject(LivingMetaService);
  protected readonly icons = CRITERION_ICONS;
  private readonly langService = inject(LangService);
  protected readonly t = this.langService.t;
  protected readonly lang = this.langService.lang;

  protected readonly areas = signal<AreaSummary[] | null>(null);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.error.set('');
    this.api.areas({ sort: 'score' }).subscribe({
      next: (result) => this.areas.set(result.data),
      error: (e: unknown) => this.error.set(describeApiError(e, this.lang())),
    });
  }
}
