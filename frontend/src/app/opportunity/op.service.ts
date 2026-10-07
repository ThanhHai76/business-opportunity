import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { OPPORTUNITY_API_URL } from '../config';
import { AskAnswer, CompareResponse, Horizon, Lang, TypesResponse, WardDetail, WardsResponse } from './op.models';

/** Message shown to the user when a request fails (never the raw HTTP error). */
export function describeError(error: unknown, lang: Lang): string {
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
export class OpportunityService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  /** GET, cached per URL (switching types, horizons or language back is instant). */
  private cached<T>(path: string, params: Record<string, string>): Observable<T> {
    const key = `${path}?${new URLSearchParams(params).toString()}`;
    let request = this.cache.get(key) as Observable<T> | undefined;
    if (!request) {
      request = this.http.get<T>(`${OPPORTUNITY_API_URL}${path}`, { params }).pipe(
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

  types(lang: Lang): Observable<TypesResponse> {
    return this.cached('/types', { lang });
  }

  wards(type: string | null, horizon: Horizon, lang: Lang): Observable<WardsResponse> {
    return this.cached('/wards', { horizon, lang, ...(type ? { type } : {}) });
  }

  ward(slug: string, horizon: Horizon, lang: Lang): Observable<WardDetail> {
    return this.cached(`/wards/${encodeURIComponent(slug)}`, { horizon, lang });
  }

  places(slug: string, type: string): Observable<GeoJSON.FeatureCollection> {
    return this.cached(`/wards/${encodeURIComponent(slug)}/places`, { type });
  }

  compare(slugs: string[], type: string | null, horizon: Horizon, lang: Lang): Observable<CompareResponse> {
    return this.http.get<CompareResponse>(`${OPPORTUNITY_API_URL}/compare`, { params: { slugs: slugs.join(','), horizon, lang, ...(type ? { type } : {}) } });
  }

  ask(question: string, context: { type: string | null; ward: string | null; horizon: Horizon; lang: Lang }): Observable<AskAnswer> {
    return this.http.post<AskAnswer>(`${OPPORTUNITY_API_URL}/ask`, {
      question: question.slice(0, 500),
      horizon: context.horizon,
      lang: context.lang,
      ...(context.type ? { type: context.type } : {}),
      ...(context.ward ? { ward: context.ward } : {}),
    });
  }
}
