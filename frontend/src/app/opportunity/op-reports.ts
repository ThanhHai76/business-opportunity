import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { ACCOUNT_API_URL } from '../config';
import { AccountService, accountError } from '../services/account.service';
import { Assumptions, RiskLevel, defaultsFor } from './op-feasibility';
import { Horizon } from './op.models';

/** A report the user saved: what the page showed at that moment (scores can change with new data later). */
export interface SavedReport {
  id: string;
  savedAt: string;
  type: string;
  typeName: string;
  icon: string;
  ward: string;
  wardName: string;
  horizon: Horizon;
  score: number;
  demand: number;
  competition: number;
  count: number;
  assumptions: Assumptions;
  result: { revenue: number; costs: number; profit: number; marginPct: number; investment: number; paybackMonths: number | null; budgetGap: number };
  risk: RiskLevel;
}

export const REPORTS_KEY = 'hanoi100.op.reports';
export const MAX_REPORTS = 30;
const opts = { withCredentials: true } as const;

const isReport = (r: unknown): r is SavedReport => {
  const x = r as Partial<SavedReport> | null;
  return (
    !!x &&
    typeof x.id === 'string' &&
    typeof x.type === 'string' &&
    typeof x.ward === 'string' &&
    typeof x.wardName === 'string' &&
    typeof x.savedAt === 'string' &&
    (x.horizon === 'now' || x.horizon === '2030') &&
    typeof x.assumptions === 'object' &&
    typeof x.result === 'object'
  );
};
const sameSlot = (a: Pick<SavedReport, 'type' | 'ward' | 'horizon'>, b: Pick<SavedReport, 'type' | 'ward' | 'horizon'>) =>
  a.type === b.type && a.ward === b.ward && a.horizon === b.horizon;

/**
 * Saved reports, newest first.
 *   - Signed out: kept in this browser only (localStorage).
 *   - Signed in: kept in the account (PostgreSQL via /api/account/reports) and shown on every device. On signing in,
 *     the reports of this browser are moved into the account (a newer copy there is never overwritten) and removed
 *     from the browser, so a shared computer does not keep them after signing out.
 * Changes show at once; when the server refuses one, the list is reloaded and `syncError` says why.
 */
@Injectable({ providedIn: 'root' })
export class SavedReportsStore {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountService);

  readonly list = signal<SavedReport[]>(this.load());
  /** Where the list lives right now. */
  readonly inAccount = computed(() => !!this.account.user());
  readonly syncing = signal(false);
  readonly syncError = signal<string | null>(null);

  constructor() {
    let lastUser: string | null | undefined;
    effect(() => {
      const id = this.account.user()?.id ?? null;
      if (id === lastUser) return;
      const first = lastUser === undefined;
      lastUser = id;
      untracked(() => {
        if (id) this.connect();
        else if (!first) this.list.set(this.load()); // signed out: back to this browser's (now empty) list
      });
    });
  }

  private load(): SavedReport[] {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? '[]');
      return (Array.isArray(raw) ? raw : [])
        .filter(isReport)
        .slice(0, MAX_REPORTS)
        .map((r) => ({ ...r, assumptions: { ...defaultsFor(r.type), ...r.assumptions } }));
    } catch {
      return [];
    }
  }

  private persist(list: SavedReport[] = this.list()): void {
    try {
      if (list.length) localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
      else localStorage.removeItem(REPORTS_KEY);
    } catch {
      /* storage full or blocked — the list still lives for this visit */
    }
  }

  /** Signed in: move this browser's reports into the account, then show the account's list. */
  private connect(): void {
    const local = this.load();
    const request: Observable<{ items: SavedReport[] }> = local.length
      ? this.http.post<{ items: SavedReport[] }>(`${ACCOUNT_API_URL}/reports/import`, { items: local }, opts)
      : this.http.get<{ items: SavedReport[] }>(`${ACCOUNT_API_URL}/reports`, opts);
    this.syncing.set(true);
    request.subscribe({
      next: ({ items }) => {
        this.syncing.set(false);
        this.syncError.set(null);
        this.list.set(items);
        if (local.length) this.persist([]);
      },
      error: (e: unknown) => {
        // Keep showing (and keeping) this browser's reports; nothing is lost.
        this.syncing.set(false);
        this.syncError.set(accountError(e));
      },
    });
  }

  private reload(error: unknown): void {
    this.syncError.set(accountError(error));
    this.http.get<{ items: SavedReport[] }>(`${ACCOUNT_API_URL}/reports`, opts).subscribe({ next: ({ items }) => this.list.set(items), error: () => {} });
  }

  /** Saves a report; the same type, ward and horizon replaces the older one. */
  save(report: Omit<SavedReport, 'id' | 'savedAt'>, now = new Date()): SavedReport {
    const saved: SavedReport = { ...report, id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, savedAt: now.toISOString() };
    this.list.update((all) => [saved, ...all.filter((r) => !sameSlot(r, report))].slice(0, MAX_REPORTS));
    if (!this.inAccount()) {
      this.persist();
      return saved;
    }
    this.http.put<{ item: SavedReport }>(`${ACCOUNT_API_URL}/reports`, report, opts).subscribe({
      // The server id replaces the temporary one (so the report can be deleted later).
      next: ({ item }) => {
        this.syncError.set(null);
        this.list.update((all) => all.map((r) => (r.id === saved.id ? item : r)));
      },
      error: (e: unknown) => this.reload(e),
    });
    return saved;
  }

  remove(id: string): void {
    this.list.update((all) => all.filter((r) => r.id !== id));
    if (!this.inAccount()) return this.persist();
    this.http.delete(`${ACCOUNT_API_URL}/reports/${encodeURIComponent(id)}`, opts).subscribe({ error: (e: unknown) => this.reload(e) });
  }

  clear(): void {
    this.list.set([]);
    if (!this.inAccount()) return this.persist();
    this.http.delete(`${ACCOUNT_API_URL}/reports`, opts).subscribe({ error: (e: unknown) => this.reload(e) });
  }

  has(type: string, ward: string, horizon: Horizon): boolean {
    return this.list().some((r) => sameSlot(r, { type, ward, horizon }));
  }
}
