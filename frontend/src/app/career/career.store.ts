import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ACCOUNT_API_URL } from '../config';
import { AccountService } from '../services/account.service';
import { BillingService } from '../services/billing.service';
import { EMPTY_PROFILE, Profile, hasAnswers, parseProfile } from './career.logic';
import { PlanState, changedAt, parsePlan, parsePlans, startPlan, toggleItem } from './career.plan';

const PROFILE_KEY = 'hanoi100.career.profile';
const PLANS_KEY = 'hanoi100.career.plans';
/** Until this was a list the page kept one plan here. */
const OLD_PLAN_KEY = 'hanoi100.career.plan';
const PUSH_DELAY_MS = 600;
const opts = { withCredentials: true } as const;

/** 30-day plans kept at once with Premium; without it, one. */
export const MAX_PLANS = 5;

export type StartResult = 'started' | 'exists' | 'limit';

function readProfile(): Profile {
  try {
    return parseProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null'));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function readPlans(): PlanState[] {
  try {
    const plans = parsePlans(JSON.parse(localStorage.getItem(PLANS_KEY) ?? 'null'));
    if (plans.length) return plans;
    const old = parsePlan(JSON.parse(localStorage.getItem(OLD_PLAN_KEY) ?? 'null'));
    return old ? [old] : [];
  } catch {
    return [];
  }
}

const planJson = (p: PlanState): string => JSON.stringify({ startedAt: p.startedAt, done: [...p.done].sort() });
const profileJson = (p: Profile): string => JSON.stringify(p);

/**
 * The visitor's career compass answers and 30-day plans, shared by the page and its tabs.
 *   - Everyone: kept in this browser (one plan without Premium).
 *   - Premium, signed in: also kept in the account (PUT /api/account/career/…), up to five plans, on every device.
 *     On signing in, this browser's data and the account's are merged (the newer plan wins), and the browser's copy is
 *     removed when the user signs out, so a shared computer keeps nothing.
 */
@Injectable({ providedIn: 'root' })
export class CareerStore {
  private readonly http = inject(HttpClient);
  private readonly account = inject(AccountService);
  private readonly billing = inject(BillingService);

  readonly profile = signal<Profile>(readProfile());
  /** The plans, newest first. */
  readonly plans = signal<PlanState[]>(readPlans());
  private readonly chosen = signal<string | null>(null);
  readonly active = computed<PlanState | null>(() => this.plans().find((p) => p.directionId === this.chosen()) ?? this.plans()[0] ?? null);

  /** The data is kept in the account too: Premium (or nothing is for sale) and signed in. */
  readonly inAccount = computed(() => !!this.account.user() && !this.billing.premiumLocked() && (!this.billing.premiumGating() || this.billing.ai()?.premium === true));
  /** Plans that can be kept at once. */
  readonly limit = computed(() => (this.billing.premiumLocked() ? 1 : MAX_PLANS));
  readonly syncing = signal(false);
  readonly syncError = signal<string | null>(null);

  private connectedFor: string | null = null;
  private pushedPlans = new Map<string, string>();
  private pushedProfile: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Keep a copy in this browser.
    effect(() => {
      const profile = this.profile();
      const plans = this.plans();
      try {
        if (hasAnswers(profile)) localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        else localStorage.removeItem(PROFILE_KEY);
        if (plans.length) localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
        else localStorage.removeItem(PLANS_KEY);
        localStorage.removeItem(OLD_PLAN_KEY);
      } catch {
        /* storage blocked: the answers still work for this visit */
      }
    });

    // Connect to the account when it applies; leave nothing behind when the user signs out of it.
    effect(() => {
      const id = this.inAccount() ? (this.account.user()?.id ?? null) : null;
      untracked(() => {
        if (id && id !== this.connectedFor) {
          this.connectedFor = id;
          this.connect();
        } else if (!id && this.connectedFor && !this.account.user()) {
          this.connectedFor = null;
          this.forgetLocal();
        } else if (!id) {
          this.connectedFor = null;
        }
      });
    });

    // Push what changed.
    effect(() => {
      this.profile();
      this.plans();
      if (untracked(() => this.connectedFor && this.inAccount())) untracked(() => this.schedulePush());
    });
  }

  // ------------------------------------------------------------- plans
  /** Starts the plan of a direction. 'limit': there is no room for another one (Premium keeps five, others one). */
  start(directionId: string, now: Date = new Date()): StartResult {
    if (this.plans().some((p) => p.directionId === directionId)) {
      this.chosen.set(directionId);
      return 'exists';
    }
    if (this.plans().length >= this.limit()) return 'limit';
    this.plans.update((all) => [startPlan(directionId, now), ...all]);
    this.chosen.set(directionId);
    return 'started';
  }

  select(directionId: string): void {
    if (this.plans().some((p) => p.directionId === directionId)) this.chosen.set(directionId);
  }

  toggle(itemId: string): void {
    const active = this.active();
    if (!active) return;
    this.plans.update((all) => all.map((p) => (p.directionId === active.directionId ? toggleItem(p, itemId) : p)));
  }

  remove(directionId: string): void {
    this.plans.update((all) => all.filter((p) => p.directionId !== directionId));
    if (this.chosen() === directionId) this.chosen.set(null);
  }

  // ------------------------------------------------------------- account
  private connect(): void {
    this.syncing.set(true);
    this.syncError.set(null);
    this.http.get<{ profile: unknown; plans: unknown[] }>(`${ACCOUNT_API_URL}/career`, opts).subscribe({
      next: ({ profile, plans }) => {
        this.syncing.set(false);
        const server = parsePlans(plans);
        this.pushedPlans = new Map(server.map((p) => [p.directionId, planJson(p)]));
        // The newer copy of each plan wins; what only this browser has is pushed next.
        const merged = new Map(server.map((p) => [p.directionId, p]));
        for (const local of this.plans()) {
          const theirs = merged.get(local.directionId);
          if (!theirs || changedAt(local) > changedAt(theirs)) merged.set(local.directionId, local);
        }
        this.plans.set([...merged.values()].sort((a, b) => changedAt(b) - changedAt(a)).slice(0, MAX_PLANS));
        // Answers: what was just entered in this browser wins; otherwise the account's.
        const serverProfile = profile ? parseProfile(profile) : null;
        if (serverProfile && !hasAnswers(this.profile())) this.profile.set(serverProfile);
        this.pushedProfile = serverProfile ? profileJson(serverProfile) : null;
        this.schedulePush(0);
      },
      error: (e: unknown) => {
        this.syncing.set(false);
        this.syncError.set(this.describe(e));
      },
    });
  }

  private schedulePush(delay = PUSH_DELAY_MS): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), delay);
  }

  private push(): void {
    if (!this.connectedFor || !this.inAccount()) return;
    const plans = this.plans();
    for (const plan of plans) {
      const json = planJson(plan);
      if (this.pushedPlans.get(plan.directionId) === json) continue;
      this.pushedPlans.set(plan.directionId, json);
      this.http.put<{ plan: PlanState }>(`${ACCOUNT_API_URL}/career/plans/${encodeURIComponent(plan.directionId)}`, { startedAt: plan.startedAt, done: plan.done }, opts).subscribe({
        next: () => this.syncError.set(null),
        error: (e: unknown) => {
          this.pushedPlans.delete(plan.directionId);
          this.syncError.set(this.describe(e));
        },
      });
    }
    for (const id of [...this.pushedPlans.keys()]) {
      if (plans.some((p) => p.directionId === id)) continue;
      this.pushedPlans.delete(id);
      this.http.delete(`${ACCOUNT_API_URL}/career/plans/${encodeURIComponent(id)}`, opts).subscribe({ error: () => undefined });
    }
    const profile = this.profile();
    if (hasAnswers(profile) && profileJson(profile) !== this.pushedProfile) {
      this.pushedProfile = profileJson(profile);
      this.http.put(`${ACCOUNT_API_URL}/career/profile`, profile, opts).subscribe({
        error: (e: unknown) => {
          this.pushedProfile = null;
          this.syncError.set(this.describe(e));
        },
      });
    }
  }

  private forgetLocal(): void {
    clearTimeout(this.timer);
    this.pushedPlans.clear();
    this.pushedProfile = null;
    this.profile.set({ ...EMPTY_PROFILE });
    this.plans.set([]);
    this.chosen.set(null);
  }

  private describe(e: unknown): string {
    const body = (e instanceof HttpErrorResponse ? e.error : null) as { message?: string } | null;
    return body?.message ?? 'Chưa đồng bộ được với tài khoản. Dữ liệu vẫn được giữ trên trình duyệt này.';
  }
}
