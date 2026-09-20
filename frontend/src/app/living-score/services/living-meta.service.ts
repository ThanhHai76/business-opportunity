import { Injectable, computed, inject, signal } from '@angular/core';
import { CRITERION_KEYS, BandKey, CriteriaResponse, CriterionDefinition, CriterionKey, CriterionMap } from '../models/living-score.models';
import { LivingScoreApiService } from './living-score-api.service';

/** Semantic score colours — single source of truth for the map, rings and bars. */
export const BAND_COLORS: Record<BandKey, string> = {
  excellent: '#1a8f5c',
  good: '#46b37e',
  fair: '#f0a020',
  low: '#e5484d',
};

/** Criteria labels, default weights and score bands, fetched once from the Scoring Engine. */
@Injectable({ providedIn: 'root' })
export class LivingMetaService {
  private readonly api = inject(LivingScoreApiService);
  private readonly data = signal<CriteriaResponse | null>(null);
  readonly loadError = signal(false);

  readonly criteria = computed<CriterionDefinition[]>(() => this.data()?.criteria ?? []);
  readonly ready = computed(() => this.data() !== null);
  readonly defaultWeights = computed<CriterionMap>(() => {
    const defs = this.criteria();
    return Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, defs.find((c) => c.key === key)?.defaultWeight ?? 0]),
    ) as CriterionMap;
  });

  load(): void {
    if (this.data()) return;
    this.loadError.set(false);
    this.api.criteria().subscribe({
      next: (response) => this.data.set(response),
      error: () => this.loadError.set(true),
    });
  }

  definition(key: CriterionKey): CriterionDefinition | undefined {
    return this.criteria().find((c) => c.key === key);
  }

  label(key: CriterionKey): string {
    return this.definition(key)?.label ?? key;
  }

  /** Maps a 0-100 value to a band using the thresholds published by the API. */
  bandFor(value: number): BandKey {
    const bands = this.data()?.bands ?? [];
    return bands.find((b) => value >= b.min)?.key ?? 'low';
  }

  bandLabel(band: BandKey): string {
    return this.data()?.bands.find((b) => b.key === band)?.label ?? '';
  }

  colorFor(value: number): string {
    return BAND_COLORS[this.bandFor(value)];
  }
}
