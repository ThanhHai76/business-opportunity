import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { BUSINESS_COPILOT_API_URL } from '../config';
import {
  Category,
  CategoryKey,
  CompareResult,
  CopilotAnswer,
  LocationDetail,
  MapLayers,
  Recommendations,
  Report,
  SimulateRequest,
  SimulationResult,
} from './bc.models';

export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Không kết nối được máy chủ. Hãy chắc chắn backend-node đang chạy (cổng 8000).';
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
    return `Yêu cầu thất bại (${error.status}).`;
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

/** REST client for the Business Copilot API. */
@Injectable({ providedIn: 'root' })
export class BcApiService {
  private readonly http = inject(HttpClient);
  private readonly base = BUSINESS_COPILOT_API_URL;

  readonly categories$ = this.http.get<{ categories: Category[] }>(`${this.base}/categories`).pipe(shareReplay(1));

  recommendations(category: CategoryKey, budgetVnd: number): Observable<Recommendations> {
    return this.http.get<Recommendations>(`${this.base}/recommendations`, { params: { category, budget: budgetVnd } });
  }

  analyze(message: string): Observable<Recommendations> {
    return this.http.post<Recommendations>(`${this.base}/analyze`, { message });
  }

  location(slug: string, category: CategoryKey, budgetVnd: number): Observable<LocationDetail> {
    return this.http.get<LocationDetail>(`${this.base}/locations/${encodeURIComponent(slug)}`, { params: { category, budget: budgetVnd } });
  }

  compare(locations: string[], category: CategoryKey, budgetVnd: number): Observable<CompareResult> {
    return this.http.post<CompareResult>(`${this.base}/compare`, { locations, category, budgetVnd });
  }

  simulate(request: SimulateRequest): Observable<SimulationResult> {
    return this.http.post<SimulationResult>(`${this.base}/simulate`, request);
  }

  ask(question: string, context: { category: CategoryKey; budgetVnd: number; location?: string }): Observable<CopilotAnswer> {
    return this.http.post<CopilotAnswer>(`${this.base}/ai/analyze`, { question, context });
  }

  report(category: CategoryKey, budgetVnd: number, location?: string): Observable<Report> {
    return this.http.post<Report>(`${this.base}/report`, { category, budgetVnd, ...(location ? { location } : {}) });
  }

  mapLayers(category: CategoryKey, budgetVnd: number): Observable<MapLayers> {
    return this.http.get<MapLayers>(`${this.base}/map/layers`, { params: { category, budget: budgetVnd } });
  }
}

const STORAGE_KEY = 'hbc.state';

interface Persisted {
  category: CategoryKey;
  budgetVnd: number;
  selected: string | null;
  compare: string[];
  prompt: string;
}

function read(): Persisted {
  const fallback: Persisted = { category: 'coffee-shop', budgetVnd: 500_000_000, selected: null, compare: ['cau-giay', 'ha-dong', 'tay-ho'], prompt: 'I have 500M VND. I want to open a coffee shop in Hanoi.' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Persisted>) } : fallback;
  } catch {
    return fallback;
  }
}

/** The business idea the user is working on, shared by every Copilot page and kept across reloads. */
@Injectable({ providedIn: 'root' })
export class BcStateService {
  private readonly initial = read();
  readonly category = signal<CategoryKey>(this.initial.category);
  readonly budgetVnd = signal<number>(this.initial.budgetVnd);
  readonly selected = signal<string | null>(this.initial.selected);
  readonly compare = signal<string[]>(this.initial.compare);
  readonly prompt = signal<string>(this.initial.prompt);
  /** Opens the side assistant with a question pre-filled. */
  readonly copilotOpen = signal(false);
  readonly copilotSeed = signal<string | null>(null);

  readonly budgetMillions = computed(() => Math.round(this.budgetVnd() / 1_000_000));

  set(patch: Partial<Persisted>): void {
    if (patch.category) this.category.set(patch.category);
    if (patch.budgetVnd) this.budgetVnd.set(patch.budgetVnd);
    if (patch.selected !== undefined) this.selected.set(patch.selected);
    if (patch.compare) this.compare.set(patch.compare.slice(0, 3));
    if (patch.prompt !== undefined) this.prompt.set(patch.prompt);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ category: this.category(), budgetVnd: this.budgetVnd(), selected: this.selected(), compare: this.compare(), prompt: this.prompt() }),
      );
    } catch {
      // storage blocked — state still works for this session
    }
  }

  toggleCompare(slug: string): boolean {
    const list = this.compare();
    if (list.includes(slug)) {
      if (list.length <= 2) return false;
      this.set({ compare: list.filter((s) => s !== slug) });
      return true;
    }
    if (list.length >= 3) this.set({ compare: [...list.slice(1), slug] });
    else this.set({ compare: [...list, slug] });
    return true;
  }

  askCopilot(question: string): void {
    this.copilotSeed.set(question);
    this.copilotOpen.set(true);
  }
}
