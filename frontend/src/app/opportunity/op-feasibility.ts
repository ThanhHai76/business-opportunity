import { Injectable, signal } from '@angular/core';

/**
 * Feasibility calculator of the Business Opportunity Map (merged from the former Business Copilot simulator).
 *
 * It is a calculator, not data: every input is an assumption the user should replace with real figures (a quoted rent,
 * their own menu prices, staff costs). The defaults per business type are rough starting points — the cost structure of
 * the former Copilot's six categories, and comparable guesses for the other types — and the page labels them so.
 */
export interface Assumptions {
  /** 'day': customers per day × days open; 'month': customers (students, deals…) per month. */
  basis: 'day' | 'month';
  customers: number;
  /** Average spend per customer (VND). */
  ticket: number;
  daysOpen: number;
  sizeM2: number;
  /** Monthly rent per m² (VND). */
  rentPerM2: number;
  /** Cost of goods sold, % of revenue. */
  cogsPct: number;
  staff: number;
  /** Monthly salary per staff (VND). */
  salary: number;
  /** Electricity, water… per m² per month (VND). */
  utilitiesPerM2: number;
  /** Marketing and other costs, % of revenue. */
  otherPct: number;
  /** Fit-out and equipment per m² (VND), paid once. */
  setupPerM2: number;
  /** Months of rent paid upfront as deposit. */
  depositMonths: number;
  /** Money available to start (VND). */
  budget: number;
  /** Months until sales reach the full level (0 = full from the first month). */
  rampMonths: number;
  /** Sales in the first month, % of the full level. */
  rampStartPct: number;
}

const base = { daysOpen: 30, rentPerM2: 350_000, depositMonths: 3, budget: 500_000_000, rampMonths: 6, rampStartPct: 50 };

export const DEFAULT_ASSUMPTIONS: Record<string, Assumptions> = {
  cafe: { ...base, basis: 'day', customers: 120, ticket: 45_000, sizeM2: 60, cogsPct: 30, staff: 4, salary: 9_000_000, utilitiesPerM2: 115_000, otherPct: 4.3, setupPerM2: 5_400_000 },
  fnb: { ...base, basis: 'day', customers: 150, ticket: 120_000, sizeM2: 110, cogsPct: 34, staff: 8, salary: 8_500_000, utilitiesPerM2: 140_000, otherPct: 5.5, setupPerM2: 4_800_000 },
  gym: { ...base, basis: 'month', customers: 300, ticket: 600_000, sizeM2: 200, cogsPct: 8, staff: 6, salary: 10_000_000, utilitiesPerM2: 95_000, otherPct: 8, setupPerM2: 2_600_000 },
  education: { ...base, basis: 'month', customers: 60, ticket: 2_500_000, sizeM2: 150, cogsPct: 15, staff: 6, salary: 10_000_000, utilitiesPerM2: 60_000, otherPct: 8, setupPerM2: 4_000_000 },
  convenience: { ...base, basis: 'day', customers: 250, ticket: 60_000, sizeM2: 60, cogsPct: 66, staff: 5, salary: 7_500_000, utilitiesPerM2: 130_000, otherPct: 3.2, setupPerM2: 4_400_000 },
  beauty: { ...base, basis: 'day', customers: 25, ticket: 250_000, sizeM2: 60, cogsPct: 20, staff: 4, salary: 8_000_000, utilitiesPerM2: 100_000, otherPct: 6, setupPerM2: 5_000_000 },
  pharmacy: { ...base, basis: 'day', customers: 80, ticket: 120_000, sizeM2: 40, cogsPct: 62, staff: 3, salary: 9_500_000, utilitiesPerM2: 90_000, otherPct: 3.5, setupPerM2: 6_500_000 },
  petshop: { ...base, basis: 'day', customers: 30, ticket: 250_000, sizeM2: 60, cogsPct: 50, staff: 3, salary: 8_000_000, utilitiesPerM2: 90_000, otherPct: 5, setupPerM2: 4_000_000 },
  realestate: { ...base, basis: 'month', customers: 3, ticket: 30_000_000, sizeM2: 40, cogsPct: 0, staff: 4, salary: 8_000_000, utilitiesPerM2: 60_000, otherPct: 15, setupPerM2: 3_000_000 },
  laundry: { ...base, basis: 'day', customers: 40, ticket: 60_000, sizeM2: 40, cogsPct: 25, staff: 2, salary: 7_000_000, utilitiesPerM2: 150_000, otherPct: 5, setupPerM2: 6_000_000 },
  bookstore: { ...base, basis: 'day', customers: 60, ticket: 120_000, sizeM2: 80, cogsPct: 60, staff: 3, salary: 7_500_000, utilitiesPerM2: 80_000, otherPct: 4, setupPerM2: 3_500_000 },
  carwash: { ...base, basis: 'day', customers: 40, ticket: 80_000, sizeM2: 100, cogsPct: 15, staff: 4, salary: 8_000_000, utilitiesPerM2: 60_000, otherPct: 5, setupPerM2: 3_000_000 },
};

export const defaultsFor = (type: string): Assumptions => ({ ...(DEFAULT_ASSUMPTIONS[type] ?? DEFAULT_ASSUMPTIONS['cafe']) });

export interface Feasibility {
  revenue: number;
  costs: { rent: number; staff: number; cogs: number; utilities: number; other: number; total: number };
  profit: number;
  marginPct: number;
  /** Fit-out plus rent deposit, paid before opening. */
  investment: number;
  /** Month the cumulative cash turns positive, sales ramp-up included (null: not within the horizon). */
  paybackMonths: number | null;
  /** Cumulative cash at the end of each month (month 1 … HORIZON_MONTHS), starting from −investment. */
  cumulative: number[];
  /** Customers per day (or per month) needed to cover the costs. */
  breakEvenCustomers: number | null;
  /** Budget minus investment (negative: missing money). */
  budgetGap: number;
}

export const HORIZON_MONTHS = 36;

/** Monthly profit and loss at full sales, investment, and the cash curve with the ramp-up (all VND). */
export function computeFeasibility(a: Assumptions): Feasibility {
  const visits = a.basis === 'day' ? a.customers * a.daysOpen : a.customers;
  const revenue = visits * a.ticket;
  const rent = a.rentPerM2 * a.sizeM2;
  const staff = a.staff * a.salary;
  const utilities = a.utilitiesPerM2 * a.sizeM2;
  const cogs = (revenue * a.cogsPct) / 100;
  const other = (revenue * a.otherPct) / 100;
  const total = rent + staff + utilities + cogs + other;
  const profit = revenue - total;
  const investment = a.setupPerM2 * a.sizeM2 + rent * a.depositMonths;
  // Each extra customer brings ticket × (1 − variable cost share); fixed costs are rent, staff and utilities.
  const contribution = a.ticket * (1 - (a.cogsPct + a.otherPct) / 100);
  const fixed = rent + staff + utilities;
  const perPeriod = contribution > 0 ? fixed / contribution : null;
  // Sales grow linearly from rampStartPct to 100 % over rampMonths; variable costs follow sales, fixed costs do not.
  const variableShare = (a.cogsPct + a.otherPct) / 100;
  const cumulative: number[] = [];
  let cash = -(a.setupPerM2 * a.sizeM2 + rent * a.depositMonths);
  let payback: number | null = null;
  for (let m = 1; m <= HORIZON_MONTHS; m++) {
    const level = a.rampMonths > 0 ? Math.min(1, a.rampStartPct / 100 + ((1 - a.rampStartPct / 100) * (m - 1)) / a.rampMonths) : 1;
    const sales = revenue * level;
    cash += sales * (1 - variableShare) - fixed;
    cumulative.push(cash);
    if (payback === null && cash >= 0) payback = m;
  }
  return {
    revenue,
    costs: { rent, staff, cogs, utilities, other, total },
    profit,
    marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
    investment,
    paybackMonths: profit > 0 ? payback : null,
    cumulative,
    breakEvenCustomers: perPeriod === null ? null : Math.ceil(a.basis === 'day' ? perPeriod / Math.max(1, a.daysOpen) : perPeriod),
    budgetGap: a.budget - investment,
  };
}

/** The user's assumptions per business type, shared by the ward panel's calculator and the printed report. */
@Injectable({ providedIn: 'root' })
export class FeasibilityStore {
  private readonly byType = signal<Record<string, Assumptions>>({});

  get(type: string): Assumptions {
    return this.byType()[type] ?? defaultsFor(type);
  }

  set(type: string, patch: Partial<Assumptions>): void {
    this.byType.update((all) => ({ ...all, [type]: { ...this.get(type), ...patch } }));
  }

  reset(type: string): void {
    this.byType.update((all) => {
      const next = { ...all };
      delete next[type];
      return next;
    });
  }

  isDefault(type: string): boolean {
    return !this.byType()[type];
  }
}

export interface PlanWard {
  slug: string;
  name: string;
  /** Opportunity score of the type in this ward. */
  score: number;
  landMedian: number | null;
  /** Competition of the type in the ward (0-100, relative between wards), when known. */
  competition?: number | null;
}

export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskReason = 'budget' | 'noPayback' | 'slowPayback' | 'thinMargin' | 'lowMargin' | 'crowded';

/**
 * Risk of a plan in a ward, from points: over budget +2; no payback within the horizon +2 (later than 18 months +1);
 * margin under 10 % +2 (under 20 % +1); competition 66+ (the densest third of wards) +1. 4+ = high, 2–3 = medium.
 */
export function riskOf(r: Feasibility, fits: boolean, competition: number | null | undefined): { level: RiskLevel; reasons: RiskReason[] } {
  const found: Array<[RiskReason, number]> = [];
  if (!fits) found.push(['budget', 2]);
  if (r.paybackMonths === null) found.push(['noPayback', 2]);
  else if (r.paybackMonths > 18) found.push(['slowPayback', 1]);
  if (r.marginPct < 10) found.push(['thinMargin', 2]);
  else if (r.marginPct < 20) found.push(['lowMargin', 1]);
  if ((competition ?? 0) >= 66) found.push(['crowded', 1]);
  const points = found.reduce((sum, [, p]) => sum + p, 0);
  return { level: points >= 4 ? 'high' : points >= 2 ? 'medium' : 'low', reasons: found.map(([reason]) => reason) };
}

export interface PlanRow extends PlanWard {
  /** Multipliers applied to the user's customers and rent in this ward (1 when not adjusted). */
  factors: { customers: number; rent: number };
  result: Feasibility;
  /** The investment fits the budget. */
  fits: boolean;
  risk: { level: RiskLevel; reasons: RiskReason[] };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

/**
 * The plan across wards: the user's assumptions in every ward, optionally adjusted by two relative indicators of
 * the ward — customers by its opportunity score against the median ward (×0.6–1.4), rent by its official land price
 * against the median ward (×0.5–2.5). Wards whose investment fits the budget come first, then by monthly profit.
 */
export function planWards(wards: PlanWard[], a: Assumptions, landCityMedian: number | null, adjust: boolean): PlanRow[] {
  const medScore = median(wards.map((w) => w.score)) || 1;
  return wards
    .map((w) => {
      const factors = adjust
        ? {
            customers: clamp(w.score / medScore, 0.6, 1.4),
            rent: w.landMedian && landCityMedian ? clamp(w.landMedian / landCityMedian, 0.5, 2.5) : 1,
          }
        : { customers: 1, rent: 1 };
      const result = computeFeasibility({ ...a, customers: Math.round(a.customers * factors.customers), rentPerM2: Math.round(a.rentPerM2 * factors.rent) });
      const fits = result.investment <= a.budget;
      return { ...w, factors, result, fits, risk: riskOf(result, fits, w.competition) };
    })
    .sort((x, y) => Number(y.fits) - Number(x.fits) || y.result.profit - x.result.profit);
}
