export interface BusinessType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface City {
  id: string;
  label: string;
}

export interface Opportunity {
  type_id: string;
  name: string;
  icon: string;
  description: string;
  demand_score: number;
  competition_index: number;
  opportunity_score: number;
  top_drivers: string[];
}

export interface AreaMetrics {
  population_growth: number;
  metro_growth: number;
  apartment_growth: number;
  school_growth: number;
  office_growth: number;
}

export interface AreaFeatureProperties {
  slug: string;
  name: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  top_opportunity: {
    type_id: string;
    name: string;
    icon: string;
    opportunity_score: number;
  };
  metrics: AreaMetrics;
}

export interface AreaFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties: AreaFeatureProperties;
}

export interface AreaFeatureCollection {
  type: 'FeatureCollection';
  features: AreaFeature[];
}

export interface AreaDetail {
  slug: string;
  name: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  summary: string;
  metrics: AreaMetrics;
  opportunities: Opportunity[];
}
