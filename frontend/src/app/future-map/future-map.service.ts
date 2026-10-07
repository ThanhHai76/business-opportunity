import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { FUTURE_MAP_API_URL } from '../config';
import { Answer, CompareResult, CorridorDetail, HubDetail, Lang, Question, RegionData, Scenario, Timeline } from './future-map.models';

/** Message shown to the user when a request fails (never the raw HTTP error). */
export function describeError(error: unknown, lang: Lang = 'vi'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return lang === 'en'
        ? 'Could not reach the server. Make sure backend-node is running (port 8000).'
        : 'Không kết nối được máy chủ. Hãy chắc chắn backend-node đang chạy (cổng 8000).';
    }
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
  }
  return lang === 'en' ? 'Something went wrong. Please try again.' : 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

@Injectable({ providedIn: 'root' })
export class FutureMapService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  /** GET, cached per URL + params (so scrubbing the timeline or switching language back is instant). */
  private cached<T>(path: string, params: Record<string, string | number>): Observable<T> {
    const key = `${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;
    let request = this.cache.get(key) as Observable<T> | undefined;
    if (!request) {
      request = this.http.get<T>(`${FUTURE_MAP_API_URL}${path}`, { params }).pipe(
        catchError((error) => {
          this.cache.delete(key);
          return throwError(() => error);
        }),
        shareReplay(1),
      );
      this.cache.set(key, request);
    }
    return request;
  }

  timeline(lang: Lang): Observable<Timeline> {
    return this.cached('/timeline', { lang });
  }

  questions(lang: Lang): Observable<{ questions: Question[] }> {
    return this.cached('/questions', { lang });
  }

  scenario(year: number, lang: Lang): Observable<Scenario> {
    return this.cached('/scenario', { year, lang });
  }

  /** The Capital Region view: corridors to the neighbouring provinces and regional infrastructure. */
  region(year: number, lang: Lang): Observable<RegionData> {
    return this.cached('/region', { year, lang });
  }

  corridor(slug: string, year: number, lang: Lang): Observable<CorridorDetail> {
    return this.http.get<CorridorDetail>(`${FUTURE_MAP_API_URL}/region/corridors/${encodeURIComponent(slug)}`, { params: { year, lang } });
  }

  hub(slug: string, year: number, lang: Lang): Observable<HubDetail> {
    return this.http.get<HubDetail>(`${FUTURE_MAP_API_URL}/hubs/${encodeURIComponent(slug)}`, { params: { year, lang } });
  }

  compare(years: number[], lang: Lang): Observable<CompareResult> {
    return this.http.get<CompareResult>(`${FUTURE_MAP_API_URL}/compare`, { params: { years: years.join(','), lang } });
  }

  /** A preset question (answered by rules from the data). */
  ask(question: string, year: number, lang: Lang): Observable<Answer> {
    return this.http.post<Answer>(`${FUTURE_MAP_API_URL}/ask`, { question, year, lang });
  }

  /** A free-text question (Claude when configured, answered only from the data; otherwise the template answerer). */
  askAi(question: string, year: number, lang: Lang): Observable<Answer> {
    return this.http.post<Answer>(`${FUTURE_MAP_API_URL}/ask-ai`, { question: question.slice(0, 500), year, lang });
  }
}
