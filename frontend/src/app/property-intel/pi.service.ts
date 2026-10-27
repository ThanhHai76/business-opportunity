import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { PROPERTY_INTEL_API_URL } from '../config';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { SiteLangService } from '../services/site-lang.service';
import { PI_TEXT } from './pi-i18n';
import { DEFAULT_WEIGHTS, Weights, decodeWeights, encodeWeights, isDefaultWeights } from './pi-weights';
import {
  AskAnswer,
  AskIntent,
  Basemap,
  Horizon,
  Lang,
  LayerKey,
  Lens,
  MapLayers,
  MetroReach,
  Overview,
  ProjectDetail,
  ProjectSummary,
  SearchResult,
  WardCommute,
  WardCommuteTo,
  WardDetail,
  WardSummary,
} from './pi.models';

export function describeError(error: unknown, lang: Lang = 'vi'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return PI_TEXT[lang].offline;
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
    return lang === 'en' ? `Request failed (${error.status}).` : `Yêu cầu thất bại (${error.status}).`;
  }
  return lang === 'en' ? 'Something went wrong. Please try again.' : 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/** REST client for /api/property-intel. Static responses are cached for the session (per language). */
@Injectable({ providedIn: 'root' })
export class PiApiService {
  private readonly http = inject(HttpClient);
  private readonly base = PROPERTY_INTEL_API_URL;
  private readonly cache = new Map<string, Observable<unknown>>();

  private cached<T>(url: string): Observable<T> {
    let hit = this.cache.get(url) as Observable<T> | undefined;
    if (!hit) {
      hit = this.http.get<T>(url, { withCredentials: true }).pipe(shareReplay(1)); // the session cookie: future planning layers are Premium
      this.cache.set(url, hit);
      // Failed requests must be retryable, not cached.
      hit.subscribe({ error: () => this.cache.delete(url) });
    }
    return hit;
  }

  overview(lang: Lang): Observable<Overview> {
    return this.cached(`${this.base}/overview?lang=${lang}`);
  }

  wards(): Observable<{ wards: WardSummary[] }> {
    return this.cached(`${this.base}/wards`);
  }

  ward(slug: string, lang: Lang): Observable<WardDetail> {
    return this.cached(`${this.base}/wards/${encodeURIComponent(slug)}?lang=${lang}`);
  }

  projects(lang: Lang): Observable<{ projects: ProjectSummary[] }> {
    return this.cached(`${this.base}/projects?lang=${lang}`);
  }

  project(slug: string, lang: Lang): Observable<ProjectDetail> {
    return this.cached(`${this.base}/projects/${encodeURIComponent(slug)}?lang=${lang}`);
  }

  map(horizon: Horizon, lang: Lang): Observable<MapLayers> {
    return this.cached(`${this.base}/map?horizon=${horizon}&lang=${lang}`);
  }

  /** Minutes by car from a ward to every ward (the career compass). */
  commute(slug: string, lang: Lang): Observable<WardCommute> {
    return this.cached(`${this.base}/commute/${encodeURIComponent(slug)}?lang=${lang}`);
  }

  /** Minutes by car from every ward to one place of work (the career compass: where to live). */
  commuteTo(target: string, lang: Lang): Observable<WardCommuteTo> {
    return this.cached(`${this.base}/commute-to/${encodeURIComponent(target)}?lang=${lang}`);
  }

  /** Metro lines near every ward and place of work: now, when the stations under construction open, and under the plan. */
  metroReach(): Observable<MetroReach> {
    return this.cached(`${this.base}/metro-reach`);
  }

  /** Schools and health facilities, loaded only when that layer is switched on. */
  mapSocial(lang: Lang): Observable<import('geojson').FeatureCollection> {
    return this.cached(`${this.base}/map/social?lang=${lang}`);
  }

  search(q: string, lang: Lang): Observable<{ results: SearchResult[] }> {
    return this.http.get<{ results: SearchResult[] }>(`${this.base}/search`, { params: { q, lang } });
  }

  ask(body: { question: string; intent?: AskIntent; ward?: string; project?: string; lang: Lang }): Observable<AskAnswer> {
    // With the session cookie: in-depth AI answers are counted per account.
    return this.http.post<AskAnswer>(`${this.base}/ask`, body, { withCredentials: true });
  }
}

const STORAGE_KEY = 'pi.state.v2';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HORIZONS: Horizon[] = [2026, 2030, 2045];
export const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  planning: true,
  development: false,
  metro: true,
  tod: true,
  infrastructure: true,
  projects: true,
  social: false,
  density: false,
  green: false,
};

export interface Persisted {
  lang: Lang;
  horizon: Horizon;
  basemap: Basemap;
  lens: Lens;
  ward: string;
  project: string;
  layers: Record<LayerKey, boolean>;
  /** Watched projects (slugs). */
  watchlist: string[];
  /** Watched wards (slugs). */
  watchWards: string[];
  /** The user's weights for the potential score (percent per criterion). */
  weights: Weights;
  /** Wards picked for side-by-side comparison (at most MAX_COMPARE). */
  compare: string[];
}

/** Wards compared side by side: Premium (and when nothing is for sale), and without Premium while it is for sale. */
export const MAX_COMPARE = 5;
export const FREE_COMPARE = 2;

export const DEFAULT_STATE: Persisted = {
  lang: 'vi',
  horizon: 2026,
  basemap: 'map',
  lens: 'potential',
  ward: 'phuong-tay-ho',
  project: 'vinhomes-skylake',
  layers: { ...DEFAULT_LAYERS },
  watchlist: [],
  watchWards: [],
  weights: { ...DEFAULT_WEIGHTS },
  compare: [],
};

/** Saved state, then the link's ?ward=&horizon=&lang=&w=&c= on top (a shared link wins over what was saved). */
export function initialState(stored: string | null, search: string): Persisted {
  let state: Persisted = { ...DEFAULT_STATE, layers: { ...DEFAULT_LAYERS }, weights: { ...DEFAULT_WEIGHTS } };
  try {
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Persisted>;
      state = { ...state, ...parsed, layers: { ...DEFAULT_LAYERS, ...parsed.layers } };
      // Keys from earlier versions (currency switch, price heat layer).
      delete (state as Partial<Persisted> & { currency?: unknown }).currency;
      delete (state.layers as Record<string, boolean>)['heatmap'];
    }
  } catch {
    // corrupted storage — defaults
  }
  if (!['map', 'satellite'].includes(state.basemap)) state.basemap = 'map';
  if (!['potential', 'connectivity', 'infrastructure', 'landPrice'].includes(state.lens)) state.lens = 'potential';
  if (!HORIZONS.includes(state.horizon)) state.horizon = 2026;
  if (state.lang !== 'en') state.lang = 'vi';
  state.weights = decodeWeights(state.weights ? encodeWeights({ ...DEFAULT_WEIGHTS, ...state.weights }) : null) ?? { ...DEFAULT_WEIGHTS };
  const slugs = (list: unknown, max: number) => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && SLUG.test(x)) : []).slice(0, max);
  state.watchlist = slugs(state.watchlist, 50);
  state.watchWards = slugs(state.watchWards, 50);
  state.compare = slugs(state.compare, MAX_COMPARE);
  const params = new URLSearchParams(search);
  const ward = params.get('ward');
  if (ward && SLUG.test(ward)) state.ward = ward;
  const horizon = Number(params.get('horizon'));
  if (HORIZONS.includes(horizon as Horizon)) state.horizon = horizon as Horizon;
  const lang = params.get('lang');
  if (lang === 'vi' || lang === 'en') state.lang = lang;
  const w = decodeWeights(params.get('w'));
  if (w) state.weights = w;
  if (params.get('c')) state.compare = slugs((params.get('c') ?? '').split(','), MAX_COMPARE);
  return state;
}

export interface ChatTurn {
  id: number;
  question: string;
  answer?: AskAnswer;
  error?: string;
}

/** Wards and projects watched without Premium (while Premium is for sale). */
export const FREE_WATCH = 3;

/** What the user is looking at, shared by every Property Intelligence page and kept across reloads. */
@Injectable({ providedIn: 'root' })
export class PiStateService {
  private readonly api = inject(PiApiService);
  private readonly premiumPrompt = inject(PremiumPromptService);
  /** Premium features are locked: the 2030 and 2045 layers, custom weights, more than FREE_WATCH watched. */
  readonly premiumLocked = inject(BillingService).premiumLocked;
  private readonly initial = initialState(readStorage(), typeof location !== 'undefined' ? location.search : '');
  private nextId = 1;

  private readonly site = inject(SiteLangService);
  /** The site's language wins over the one saved with the rest of this page's state. */
  readonly lang = signal<Lang>(this.site.lang());
  readonly t = computed(() => PI_TEXT[this.lang()]);
  readonly horizon = signal<Horizon>(this.initial.horizon);
  readonly basemap = signal<Basemap>(this.initial.basemap);
  readonly lens = signal<Lens>(this.initial.lens);
  readonly ward = signal<string>(this.initial.ward);
  readonly project = signal<string>(this.initial.project);
  readonly layers = signal<Record<LayerKey, boolean>>(this.initial.layers);
  readonly watchlist = signal<string[]>(this.initial.watchlist);
  readonly watchWards = signal<string[]>(this.initial.watchWards);
  readonly weights = signal<Weights>(this.initial.weights);
  readonly customWeights = computed(() => !isDefaultWeights(this.weights()));
  readonly compare = signal<string[]>(this.initial.compare);
  readonly compareLimit = computed(() => (this.premiumLocked() ? FREE_COMPARE : MAX_COMPARE));

  readonly chat = signal<ChatTurn[]>([]);
  readonly asking = signal(false);
  /** Project report dialog (opened from the shell header). */
  readonly reportOpen = signal(false);

  constructor() {
    // The language is chosen once for the whole site (top bar or this page's button): this state follows it.
    effect(() => {
      const next = this.site.lang();
      untracked(() => {
        if (next !== this.lang()) this.set('lang', next);
      });
    });
    // Once the future layers turn out to be locked (saved state or a shared link on 2030/2045), show today.
    effect(() => {
      if (this.premiumLocked() && this.horizon() !== HORIZONS[0]) untracked(() => this.set('horizon', HORIZONS[0]));
    });
  }

  /** Opens the Premium prompt for a feature, in the page's language. */
  askPremium(feature: string): void {
    this.premiumPrompt.open(feature, this.lang());
  }

  /** Picks a planning horizon; the future ones ask for Premium while locked. */
  setHorizon(h: Horizon): void {
    if (h !== HORIZONS[0] && this.premiumLocked()) return this.askPremium(this.t().premium.horizon(h));
    this.set('horizon', h);
  }

  /** False (and the Premium prompt) when one more watched item would go over the free limit. */
  private canWatchMore(): boolean {
    if (!this.premiumLocked() || this.watchlist().length + this.watchWards().length < FREE_WATCH) return true;
    this.askPremium(this.t().premium.watch);
    return false;
  }

  toggleLayer(key: LayerKey): void {
    this.layers.update((l) => ({ ...l, [key]: !l[key] }));
    this.save();
  }

  setLayers(on: LayerKey[]): void {
    this.layers.update((l) => Object.fromEntries(Object.keys(l).map((k) => [k, on.includes(k as LayerKey)])) as Record<LayerKey, boolean>);
    this.save();
  }

  set<K extends 'lang' | 'horizon' | 'basemap' | 'lens' | 'ward' | 'project'>(key: K, value: Persisted[K]): void {
    if (key === 'lang') this.site.set(value as Lang);
    (this[key] as WritableSignal<Persisted[K]>).set(value);
    this.save();
  }

  toggleWatch(slug: string): void {
    if (!this.watchlist().includes(slug) && !this.canWatchMore()) return;
    this.watchlist.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
    this.save();
  }

  toggleWatchWard(slug: string): void {
    if (!this.watchWards().includes(slug) && !this.canWatchMore()) return;
    this.watchWards.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
    this.save();
  }

  setWeight(key: keyof Weights, value: number): void {
    this.weights.update((w) => ({ ...w, [key]: Math.max(0, Math.min(100, Math.round(value))) }));
    this.save();
  }

  setWeights(w: Weights): void {
    this.weights.set({ ...w });
    this.save();
  }

  resetWeights(): void {
    this.setWeights(DEFAULT_WEIGHTS);
  }

  /** Adds or removes a ward from the comparison; without Premium a third asks for it, and with it the oldest leaves when a sixth is added. */
  toggleCompare(slug: string): void {
    if (!this.compare().includes(slug) && this.compare().length >= this.compareLimit() && this.premiumLocked()) return this.askPremium(this.t().premium.compare);
    this.compare.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug].slice(-MAX_COMPARE)));
    this.save();
  }

  setCompare(list: string[]): void {
    this.compare.set(list.slice(0, MAX_COMPARE));
    this.save();
  }

  /** Link to what is on screen: the page path plus ward, horizon, language, custom weights and the comparison. */
  shareUrl(path: string): string {
    const params = new URLSearchParams();
    params.set('ward', this.ward());
    params.set('horizon', String(this.horizon()));
    if (this.lang() === 'en') params.set('lang', 'en');
    if (this.customWeights()) params.set('w', encodeWeights(this.weights()));
    if (this.compare().length) params.set('c', this.compare().join(','));
    return `${location.origin}${path.split('?')[0]}?${params}`;
  }

  /** Sends a question to the analyst; answers stack up in `chat` (the newest last). */
  ask(question: string, intent?: AskIntent): void {
    const text = question.trim();
    if (!text || this.asking()) return;
    const id = this.nextId++;
    const lang = this.lang();
    this.chat.update((turns) => [...turns, { id, question: text }].slice(-12));
    this.asking.set(true);
    this.api.ask({ question: text, intent, ward: this.ward(), project: intent === 'project' ? this.project() : undefined, lang }).subscribe({
      next: (answer) => {
        this.patchTurn(id, { answer });
        this.asking.set(false);
      },
      error: (err) => {
        this.patchTurn(id, { error: describeError(err, lang) });
        this.asking.set(false);
      },
    });
  }

  private patchTurn(id: number, patch: Partial<ChatTurn>): void {
    this.chat.update((turns) => turns.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  private save(): void {
    const state: Persisted = {
      lang: this.lang(),
      horizon: this.horizon(),
      basemap: this.basemap(),
      lens: this.lens(),
      ward: this.ward(),
      project: this.project(),
      layers: this.layers(),
      watchlist: this.watchlist(),
      watchWards: this.watchWards(),
      weights: this.weights(),
      compare: this.compare(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage blocked — state still applies for this session
    }
  }
}

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
