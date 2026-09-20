import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { LIVING_SCORE_API_URL } from '../../config';
import {
  AmenityGeoJson,
  AmenityType,
  ApiError,
  AreaDetail,
  AreaGeoJson,
  AreaList,
  CompareResult,
  CriteriaResponse,
  CriterionKey,
  CRITERION_KEYS,
  InfrastructureGeoJson,
  PartialWeights,
  RecommendationRequest,
  RecommendationResponse,
  SearchResult,
} from '../models/living-score.models';

/** Serialises personalised weights as "transportation:20,cost:5" (omitted when there are none). */
export function weightsParam(weights: PartialWeights | null | undefined): string | undefined {
  if (!weights) return undefined;
  const parts = CRITERION_KEYS.filter((key) => weights[key] !== undefined).map((key) => `${key}:${weights[key]}`);
  return parts.length ? parts.join(',') : undefined;
}

/** Best human-readable message for a failed API call (Vietnamese messages come from the API itself). */
export function describeApiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Không kết nối được máy chủ Hanoi Living Score. Hãy chắc chắn backend-node đang chạy (cổng 8000).';
    }
    const body = error.error as Partial<ApiError> | null;
    const message = body?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
    return `Yêu cầu thất bại (${error.status}).`;
  }
  return 'Đã xảy ra lỗi không mong muốn.';
}

@Injectable({ providedIn: 'root' })
export class LivingScoreApiService {
  private readonly http = inject(HttpClient);
  private readonly criteria$ = this.http.get<CriteriaResponse>(`${LIVING_SCORE_API_URL}/scoring/criteria`).pipe(shareReplay(1));

  criteria(): Observable<CriteriaResponse> {
    return this.criteria$;
  }

  areas(options: { q?: string; sort?: 'score' | 'name' | 'rent'; weights?: PartialWeights | null } = {}): Observable<AreaList> {
    return this.http.get<AreaList>(`${LIVING_SCORE_API_URL}/areas`, {
      params: this.params({ q: options.q, sort: options.sort, weights: weightsParam(options.weights) }),
    });
  }

  areasGeoJson(options: { criterion?: CriterionKey | null; weights?: PartialWeights | null } = {}): Observable<AreaGeoJson> {
    return this.http.get<AreaGeoJson>(`${LIVING_SCORE_API_URL}/areas/geojson`, {
      params: this.params({ criterion: options.criterion ?? undefined, weights: weightsParam(options.weights) }),
    });
  }

  areaDetail(slug: string, weights?: PartialWeights | null): Observable<AreaDetail> {
    return this.http.get<AreaDetail>(`${LIVING_SCORE_API_URL}/areas/${encodeURIComponent(slug)}`, {
      params: this.params({ weights: weightsParam(weights) }),
    });
  }

  compare(slugs: string[], weights?: PartialWeights | null): Observable<CompareResult> {
    return this.http.get<CompareResult>(`${LIVING_SCORE_API_URL}/compare`, {
      params: this.params({ slugs: slugs.join(','), weights: weightsParam(weights) }),
    });
  }

  amenities(types: AmenityType[]): Observable<AmenityGeoJson> {
    return this.http.get<AmenityGeoJson>(`${LIVING_SCORE_API_URL}/amenities`, {
      params: this.params({ types: types.length ? types.join(',') : undefined }),
    });
  }

  infrastructure(): Observable<InfrastructureGeoJson> {
    return this.http.get<InfrastructureGeoJson>(`${LIVING_SCORE_API_URL}/infrastructure`);
  }

  search(q: string): Observable<SearchResult> {
    return this.http.get<SearchResult>(`${LIVING_SCORE_API_URL}/search`, { params: this.params({ q }) });
  }

  recommend(request: RecommendationRequest): Observable<RecommendationResponse> {
    return this.http.post<RecommendationResponse>(`${LIVING_SCORE_API_URL}/recommendations`, request);
  }

  private params(values: Record<string, string | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return params;
  }
}
