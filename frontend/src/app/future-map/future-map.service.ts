import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { FUTURE_MAP_API_URL } from '../config';
import { Answer, CompareResult, HubDetail, Question, Scenario, Timeline } from './future-map.models';

/** Message shown to the user when a request fails (never the raw HTTP error). */
export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Không kết nối được máy chủ. Hãy chắc chắn backend-node đang chạy (cổng 8000).';
    const message = (error.error as { message?: unknown } | null)?.message;
    if (typeof message === 'string') return message;
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

@Injectable({ providedIn: 'root' })
export class FutureMapService {
  private readonly http = inject(HttpClient);
  private readonly scenarios = new Map<number, Observable<Scenario>>();

  readonly timeline$ = this.http.get<Timeline>(`${FUTURE_MAP_API_URL}/timeline`).pipe(shareReplay(1));
  readonly questions$ = this.http.get<{ questions: Question[] }>(`${FUTURE_MAP_API_URL}/questions`).pipe(shareReplay(1));

  /** Every layer for one year. Cached per year, so scrubbing the timeline back and forth is instant. */
  scenario(year: number): Observable<Scenario> {
    let request = this.scenarios.get(year);
    if (!request) {
      request = this.http.get<Scenario>(`${FUTURE_MAP_API_URL}/scenario`, { params: { year } }).pipe(
        catchError((error) => {
          this.scenarios.delete(year);
          return throwError(() => error);
        }),
        shareReplay(1),
      );
      this.scenarios.set(year, request);
    }
    return request;
  }

  hub(slug: string, year: number): Observable<HubDetail> {
    return this.http.get<HubDetail>(`${FUTURE_MAP_API_URL}/hubs/${encodeURIComponent(slug)}`, { params: { year } });
  }

  compare(years: number[]): Observable<CompareResult> {
    return this.http.get<CompareResult>(`${FUTURE_MAP_API_URL}/compare`, { params: { years: years.join(',') } });
  }

  ask(question: string, year: number): Observable<Answer> {
    return this.http.post<Answer>(`${FUTURE_MAP_API_URL}/ask`, { question, year });
  }
}
