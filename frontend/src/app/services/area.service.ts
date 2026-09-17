import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AreaDetail, AreaFeatureCollection, BusinessType, City } from '../models/area.model';
import { API_BASE_URL } from '../config';

@Injectable({ providedIn: 'root' })
export class AreaService {
  constructor(private http: HttpClient) {}

  getCities(): Observable<City[]> {
    return this.http.get<City[]>(`${API_BASE_URL}/api/cities`);
  }

  getAreas(city: string): Observable<AreaFeatureCollection> {
    return this.http.get<AreaFeatureCollection>(`${API_BASE_URL}/api/areas`, { params: { city } });
  }

  getAreaDetail(slug: string): Observable<AreaDetail> {
    return this.http.get<AreaDetail>(`${API_BASE_URL}/api/areas/${slug}`);
  }

  getBusinessTypes(): Observable<BusinessType[]> {
    return this.http.get<BusinessType[]>(`${API_BASE_URL}/api/business-types`);
  }
}
