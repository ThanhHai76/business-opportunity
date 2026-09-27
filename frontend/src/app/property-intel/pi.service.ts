import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { PROPERTY_INTEL_API_URL } from '../config';
import {
  AskAnswer,
  AskIntent,
  Basemap,
  Currency,
  DistrictDetail,
  DistrictSummary,
  Horizon,
  LayerKey,
  Lens,
  MapLayers,
  Overview,
  ProjectDetail,
  ProjectSummary,
  SearchResult,
} from './pi.models';

export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Không kết nối được máy chủ. Hãy chắc chắn backend-node đang chạy (cổng 8000).';
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
    return `Yêu cầu thất bại (${error.status}).`;
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/** REST client for /api/property-intel. Static responses are cached for the session. */
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

  overview(): Observable<Overview> {
    return this.cached(`${this.base}/overview`);
  }

  districts(): Observable<{ districts: DistrictSummary[] }> {
    return this.cached(`${this.base}/districts`);
  }

  district(slug: string): Observable<DistrictDetail> {
    return this.cached(`${this.base}/districts/${encodeURIComponent(slug)}`);
  }

  projects(): Observable<{ projects: ProjectSummary[] }> {
    return this.cached(`${this.base}/projects`);
  }

  project(slug: string): Observable<ProjectDetail> {
    return this.cached(`${this.base}/projects/${encodeURIComponent(slug)}`);
  }

  map(horizon: Horizon): Observable<MapLayers> {
    return this.cached(`${this.base}/map?horizon=${horizon}`);
  }

  search(q: string): Observable<{ results: SearchResult[] }> {
    return this.http.get<{ results: SearchResult[] }>(`${this.base}/search`, { params: { q } });
  }

  ask(body: { question: string; intent?: AskIntent; district?: string; project?: string }): Observable<AskAnswer> {
    return this.http.post<AskAnswer>(`${this.base}/ask`, body);
  }
}

const STORAGE_KEY = 'pi.state';
const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  planning: true,
  development: true,
  metro: true,
  tod: true,
  infrastructure: true,
  projects: true,
  heatmap: true,
  social: true,
  density: false,
  green: false,
};

interface Persisted {
  currency: Currency;
  horizon: Horizon;
  basemap: Basemap;
  lens: Lens;
  district: string;
  project: string;
  layers: Record<LayerKey, boolean>;
  watchlist: string[];
}

function read(): Persisted {
  const fallback: Persisted = {
    currency: 'VND',
    horizon: 2030,
    basemap: 'satellite',
    lens: 'growth',
    district: 'gia-lam',
    project: 'riverside-aurora',
    layers: { ...DEFAULT_LAYERS },
    watchlist: [],
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { ...fallback, ...parsed, layers: { ...DEFAULT_LAYERS, ...parsed.layers } };
  } catch {
    return fallback;
  }
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
  private readonly initial = read();
  private nextId = 1;

  readonly currency = signal<Currency>(this.initial.currency);
  readonly horizon = signal<Horizon>(this.initial.horizon);
  readonly basemap = signal<Basemap>(this.initial.basemap);
  readonly lens = signal<Lens>(this.initial.lens);
  readonly district = signal<string>(this.initial.district);
  readonly project = signal<string>(this.initial.project);
  readonly layers = signal<Record<LayerKey, boolean>>(this.initial.layers);
  readonly watchlist = signal<string[]>(this.initial.watchlist);
  /** Sample VND per USD from the API; used by the currency switch. */
  readonly vndPerUsd = signal(25_400);

  readonly chat = signal<ChatTurn[]>([]);
  readonly asking = signal(false);
  /** Investment report dialog for the current project (opened from the shell header). */
  readonly reportOpen = signal(false);

  toggleLayer(key: LayerKey): void {
    this.layers.update((l) => ({ ...l, [key]: !l[key] }));
    this.save();
  }

  set<K extends 'currency' | 'horizon' | 'basemap' | 'lens' | 'district' | 'project'>(key: K, value: Persisted[K]): void {
    (this[key] as WritableSignal<Persisted[K]>).set(value);
    this.save();
  }

  toggleWatch(slug: string): void {
    this.watchlist.update((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
    this.save();
  }

  /** Sends a question to the analyst; answers stack up in `chat` (the newest last). */
  ask(question: string, intent?: AskIntent): void {
    const text = question.trim();
    if (!text || this.asking()) return;
    const id = this.nextId++;
    this.chat.update((turns) => [...turns, { id, question: text }].slice(-12));
    this.asking.set(true);
    this.api.ask({ question: text, intent, district: this.district(), project: this.project() }).subscribe({
      next: (answer) => {
        this.patchTurn(id, { answer });
        this.asking.set(false);
      },
      error: (err) => {
        this.patchTurn(id, { error: describeError(err) });
        this.asking.set(false);
      },
    });
  }

  private patchTurn(id: number, patch: Partial<ChatTurn>): void {
    this.chat.update((turns) => turns.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  private save(): void {
    const state: Persisted = {
      currency: this.currency(),
      horizon: this.horizon(),
      basemap: this.basemap(),
      lens: this.lens(),
      district: this.district(),
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
