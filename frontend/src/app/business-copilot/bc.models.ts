/** Types mirroring the Hanoi Business Copilot REST API (backend-node/src/business-copilot). */

export type CategoryKey = 'coffee-shop' | 'restaurant' | 'retail-store' | 'gym' | 'pharmacy' | 'convenience-store';
export type Level = 'Low' | 'Medium' | 'High';

export interface Category {
  key: CategoryKey;
  name: string;
  nameVi: string;
  icon: string;
  avgSizeM2: number;
}

export interface ScoreSet {
  demand: number;
  competition: number;
  rent: number;
  traffic: number;
  accessibility: number;
  growth: number;
  budgetFit: number;
}

export interface LocationSummary {
  rank: number;
  slug: string;
  name: string;
  cluster: string;
  center: [number, number];
  businessScore: number;
  scores: ScoreSet;
  competitionLabel: Level;
  estRentMillions: number;
  footTraffic: number;
  accessibility: number;
  customerDensityKPerKm2: number;
  investmentLevel: Level;
  withinBudget: boolean;
  revenuePotentialMillions: number;
  breakEvenMonth: number | null;
  tags: string[];
}

export interface Narrative {
  summary: string;
  recommendation: string;
  evidence: string[];
  risks: string[];
  nextActions: string[];
}

export interface HeatmapMarker {
  rank: number;
  slug: string;
  name: string;
  x: number;
  y: number;
}

export interface OpportunityHeatmap {
  width: number;
  height: number;
  grid: number[][];
  markers: HeatmapMarker[];
}

export interface Recommendations {
  category: { key: CategoryKey; name: string; nameVi: string };
  budgetMillions: number;
  recommendations: LocationSummary[];
  heatmap: OpportunityHeatmap;
  insight: Narrative;
  provider: string;
  parsed?: { category: CategoryKey; budgetVnd: number; districts: string[]; assumedBudget: boolean };
  note: string;
}

export interface CompetitorSubtype {
  key: string;
  label: string;
  count: number;
  reachK: number;
}

export interface RevenuePoint {
  month: number;
  revenue: number;
  cost: number;
  cumulative: number;
  afterBreakEven: boolean;
}

export interface CostItem {
  key: string;
  label: string;
  millions: number;
}

export interface LocationDetail {
  slug: string;
  name: string;
  cluster: string;
  center: [number, number];
  category: { key: CategoryKey; name: string; nameVi: string };
  budgetMillions: number;
  rank: number;
  rankOf: number;
  totalScore: number;
  scores: ScoreSet;
  competitionLabel: Level;
  competitors: { total: number; subtypes: CompetitorSubtype[] };
  customerDensityKPerKm2: number;
  estRentMillions: number;
  revenuePotentialMillions: number;
  monthlyCostMillions: number;
  netMarginPct: number;
  breakEvenMonth: number | null;
  revenueSeries: RevenuePoint[];
  investmentLevel: Level;
  withinBudget: boolean;
  initialInvestment: {
    totalMillions: number;
    fitOutMillions: number;
    equipmentMillions: number;
    depositMillions: number;
    workingCapitalMillions: number;
  };
  monthlyCosts: { totalMillions: number; items: CostItem[] };
  confidence: number;
  fitLabel: string;
  attributes: {
    population: number;
    areaKm2: number;
    incomeIndex: number;
    officeWorkersK: number;
    studentsK: number;
    schools: number;
    universities: number;
    offices: number;
    nearestMetro: { line: string; station: string; distanceM: number } | null;
    developmentZone: boolean;
  };
  evidence: string[];
  targetCustomers: Array<{ key: string; label: string; pct: number }>;
  footTraffic: {
    days: string[];
    hours: number[];
    grid: number[][];
    peak: { day: string; from: string; to: string };
    weekendChangePct: number;
  };
  competitorGap: string;
  risks: Array<{ text: string; severity: Level }>;
  growthOpportunities: Array<{ text: string; timing: string }>;
  recommendation: string;
  note: string;
}

export interface CompareMetric {
  key: string;
  label: string;
  values: Record<string, number | string | null>;
  best: string[];
}

export interface CompareResult {
  category: { key: CategoryKey; name: string; nameVi: string };
  budgetMillions: number;
  locations: Array<{ slug: string; name: string; businessScore: number; scores: ScoreSet }>;
  metrics: CompareMetric[];
  winner: string;
  summary: string;
}

export interface SimulateRequest {
  category: CategoryKey;
  budgetVnd: number;
  sizeM2?: number;
  expectedRevenueVnd?: number;
  maxRentVnd?: number;
  targetCustomers?: string[];
  districts?: string[];
}

export interface SimulationRow {
  slug: string;
  name: string;
  businessScore: number;
  rentMillions: number;
  revenueMillions: number;
  costMillions: number;
  profitMillions: number;
  marginPct: number;
  initialInvestmentMillions: number;
  breakEvenMonth: number | null;
  withinBudget: boolean;
  riskLevel: Level;
  competitionLabel: Level;
}

export interface SimulationResult {
  category: { key: CategoryKey; nameVi: string };
  inputs: { budgetMillions: number; sizeM2: number };
  results: SimulationRow[];
  excluded: Array<{ slug: string; name: string; rentMillions: number }>;
  summary: {
    recommended: string[];
    monthlyCostMillions: number;
    monthlyRevenueMillions: number;
    monthlyProfitMillions: number;
    breakEvenMonth: number | null;
    riskLevel: Level;
    initialInvestmentMillions: number;
    paybackYears: number | null;
  } | null;
}

export interface CopilotAnswer {
  intent: string;
  question: string;
  answer: Narrative;
  scores: Array<{ label: string; value: number }>;
  locations: string[];
  provider: string;
  model: string | null;
  notice?: string;
}

export interface Report {
  title: string;
  generatedAt: string;
  business: { key: CategoryKey; name: string; nameVi: string };
  budgetMillions: number;
  recommendedLocation: { slug: string; name: string; cluster: string };
  businessScore: number;
  provider: string;
  sections: {
    executiveSummary: { summary: string; recommendation: string };
    marketDemand: { demandScore: number; trafficScore: number; customerDensityKPerKm2: number; peak: { day: string; from: string; to: string }; weekendChangePct: number; evidence: string[] };
    competition: { label: Level; score: number; total: number; subtypes: CompetitorSubtype[]; gap: string };
    estimatedCosts: {
      initialInvestment: LocationDetail['initialInvestment'];
      monthlyCosts: LocationDetail['monthlyCosts'];
      revenuePotentialMillions: number;
      netMarginPct: number;
      breakEvenMonth: number | null;
    };
    customerProfile: LocationDetail['targetCustomers'];
    locationAnalysis: { scores: ScoreSet; attributes: LocationDetail['attributes']; alternatives: LocationSummary[] };
    growthPotential: { growthScore: number; opportunities: LocationDetail['growthOpportunities'] };
    risks: LocationDetail['risks'];
    aiRecommendation: { recommendation: string; nextActions: string[] };
  };
  note: string;
}

export interface MapLayers {
  layers: Record<'areas' | 'heat' | 'competitors' | 'metroLines' | 'metroStations' | 'schools' | 'offices' | 'shopping' | 'roads' | 'developmentZones', GeoJSON.FeatureCollection>;
  note: string;
}

export const SCORE_LABELS: Record<keyof ScoreSet, string> = {
  demand: 'Nhu cầu',
  competition: 'Cạnh tranh',
  rent: 'Giá thuê',
  traffic: 'Lưu lượng khách',
  accessibility: 'Tiếp cận metro',
  growth: 'Tăng trưởng',
  budgetFit: 'Phù hợp ngân sách',
};
