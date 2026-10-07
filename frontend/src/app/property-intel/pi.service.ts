import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { PROPERTY_INTEL_API_URL } from '../config';
import { PI_TEXT } from './pi-i18n';
import {
  AskAnswer,
  AskIntent,
  Basemap,
  Horizon,
  Lang,
  LayerKey,
  Lens,
  MapLayers,
  Overview,
  ProjectDetail,
  ProjectSummary,
  SearchResult,
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
      hit = this.http.get<T>(url).pipe(shareReplay(1));
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

  search(q: string, lang: Lang): Observable<{ results: SearchResult[] }> {
    return this.http.get<{ results: SearchResult[] }>(`${this.base}/search`, { params: { q, lang } });
  }

  ask(body: { question: string; intent?: AskIntent; ward?: string; project?: string; lang: Lang }): Observable<AskAnswer> {
    return this.http.post<AskAnswer>(`${this.base}/ask`, body);
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
  watchlist: string[];
}

export const DEFAULT_STATE: Persisted = {
  lang: 'vi',
  horizon: 2026,
  basemap: 'map',
  lens: 'potential',
  ward: 'phuong-bo-de',
  project: 'vinhomes-skylake',
  layers: { ...DEFAULT_LAYERS },
  watchlist: [],
};

/** Saved state, then the link's ?ward=&horizon=&lang= on top (a shared link wins over what was saved). */
export function initialState(stored: string | null, search: string): Persisted {
  let state: Persisted = { ...DEFAULT_STATE, layers: { ...DEFAULT_LAYERS } };
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
  const params = new URLSearchParams(search);
  const ward = params.get('ward');
  if (ward && SLUG.test(ward)) state.ward = ward;
  const horizon = Number(params.get('horizon'));
  if (HORIZONS.includes(horizon as Horizon)) state.horizon = horizon as Horizon;
  const lang = params.get('lang');
  if (lang === 'vi' || lang === 'en') state.lang = lang;
  return state;
}

export interface ChatTurn {
  id: number;
  question: string;
  answer?: AskAnswer;
  error?: string;
}

/** What the user is looking at, shared by every Property Intelligence page and kept across reloads. */
@Injectable({ providedIn: 'root' })
export class PiStateService {
  private readonly api = inject(PiApiService);
  private readonly initial = initialState(readStorage(), typeof location !== 'undefined' ? location.search : '');
  private nextId = 1;

  readonly lang = signal<Lang>(this.initial.lang);
  readonly t = computed(() => PI_TEXT[this.lang()]);
  readonly horizon = signal<Horizon>(this.initial.horizon);
  readonly basemap = signal<Basemap>(this.initial.basemap);
  readonly lens = signal<Lens>(this.initial.lens);
  readonly ward = signal<string>(this.initial.ward);
  readonly project = signal<string>(this.initial.project);
  readonly layers = signal<Record<LayerKey, boolean>>(this.initial.layers);
  readonly watchlist = signal<string[]>(this.initial.watchlist);

  readonly chat = signal<ChatTurn[]>([]);
  readonly asking = signal(false);
  /** Project report dialog (opened from the shell header). */
  readonly reportOpen = signal(false);

  toggleLayer(key: LayerKey): void {
    this.layers.update((l) => ({ ...l, [key]: !l[key] }));
    this.save();
  }

  setLayers(on: LayerKey[]): void {
    this.layers.update((l) => Object.fromEntries(Object.keys(l).map((k) => [k, on.includes(k as LayerKey)])) as Record<LayerKey, boolean>);
    this.save();
  }

  set<K extends 'lang' | 'horizon' | 'basemap' | 'lens' | 'ward' | 'project'>(key: K, value: Persisted[K]): void {
    (this[key] as WritableSignal<Persisted[K]>).set(value);
    this.save();
  }

  toggleWatch(slug: string): void {
    this.watchlist.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
    this.save();
  }

  /** Link to what is on screen: the page path plus ward, horizon and language. */
  shareUrl(path: string): string {
    const params = new URLSearchParams();
    params.set('ward', this.ward());
    params.set('horizon', String(this.horizon()));
    if (this.lang() === 'en') params.set('lang', 'en');
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
