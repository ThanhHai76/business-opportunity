import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  CRITERION_KEYS,
  BandKey,
  CriteriaResponse,
  CriterionDefinition,
  CriterionKey,
  CriterionMap,
  DataInfo,
  MissingCriterion,
} from '../models/living-score.models';
import { LangService } from './lang.service';
import { LivingScoreApiService } from './living-score-api.service';

/**
 * Semantic score colours — single source of truth for the map, rings and bars.
 * A warm-to-green scale without red: a low score means "weaker here", not "danger".
 */
export const BAND_COLORS: Record<BandKey, string> = {
  excellent: '#16a06f',
  good: '#5bbf8a',
  fair: '#f2b134',
  low: '#f08a4b',
};

/** Criteria labels, default weights and score bands, fetched once from the Scoring Engine. */
@Injectable({ providedIn: 'root' })
export class LivingMetaService {
  private readonly api = inject(LivingScoreApiService);
  private readonly langService = inject(LangService);
  private readonly data = signal<CriteriaResponse | null>(null);
  private loaded = false;
  readonly loadError = signal(false);

  readonly criteria = computed<CriterionDefinition[]>(() => this.data()?.criteria ?? []);
  /** Criteria with no open per-area data (safety, environment, cost): shown as "no data", never scored. */
  readonly missing = computed<MissingCriterion[]>(() => this.data()?.missing ?? []);
  readonly missingLabels = computed(() =>
    this.missing()
      .map((c) => (this.langService.lang() === 'en' ? c.labelEn : c.label).toLowerCase())
      .join(', '),
  );
  /** Source, licence, date and method of the numbers. */
  readonly dataInfo = computed<DataInfo | null>(() => this.data()?.data ?? null);
  /** OSM snapshot date as dd/mm/yyyy. */
  readonly osmDate = computed(() => {
    const iso = this.dataInfo()?.osmDate?.slice(0, 10) ?? '';
    return this.langService.lang() === 'en' ? iso : iso.split('-').reverse().join('/');
  });

  constructor() {
    // Data info (method, notes) is localised by the API: fetch it again when the language changes.
    effect(() => {
      this.langService.lang();
      if (untracked(() => this.loaded)) untracked(() => this.fetch());
    });
  }
  readonly ready = computed(() => this.data() !== null);
  readonly defaultWeights = computed<CriterionMap>(() => {
    const defs = this.criteria();
    return Object.fromEntries(
      CRITERION_KEYS.map((key) => [key, defs.find((c) => c.key === key)?.defaultWeight ?? 0]),
    ) as CriterionMap;
  });

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.fetch();
  }

  private fetch(): void {
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
    const def = this.definition(key);
    if (!def) return key;
    return this.langService.lang() === 'en' ? def.labelEn : def.label;
  }

  /** "an ninh" / "Safety" … in the interface language. */
  missingLabel(c: MissingCriterion): string {
    return this.langService.lang() === 'en' ? c.labelEn : c.label;
  }

  missingReason(c: MissingCriterion): string {
    return this.langService.lang() === 'en' ? (c.reasonEn ?? c.reason) : c.reason;
  }

  /** Maps a 0-100 value to a band using the thresholds published by the API. */
  bandFor(value: number): BandKey {
    const bands = this.data()?.bands ?? [];
    return bands.find((b) => value >= b.min)?.key ?? 'low';
  }

  bandLabel(band: BandKey): string {
    const b = this.data()?.bands.find((x) => x.key === band);
    if (!b) return '';
    return this.langService.lang() === 'en' ? b.labelEn : b.label;
  }

  colorFor(value: number): string {
    return BAND_COLORS[this.bandFor(value)];
  }
}
