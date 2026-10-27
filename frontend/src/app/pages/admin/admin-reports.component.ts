import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FEEDBACK_API_URL } from '../../config';
import { AccountService } from '../../services/account.service';

export type ReportStatus = 'new' | 'checked' | 'fixed' | 'rejected';

export interface AdminReport {
  id: string;
  kind: 'ward' | 'source';
  target: string;
  targetName: string | null;
  page: string | null;
  message: string;
  contact: string | null;
  status: ReportStatus;
  createdAt: string;
}

export const STATUS_LABEL: Record<ReportStatus, string> = { new: 'Mới', checked: 'Đã xem', fixed: 'Đã sửa', rejected: 'Không đúng' };
const STATUSES = Object.keys(STATUS_LABEL) as ReportStatus[];

/**
 * /admin/reports: the reports of wrong figures ("Báo sai số liệu") for the person who runs the site.
 * The server decides who may read them (ADMIN_EMAILS, verified address); this page only shows what it answers.
 */
@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="ar">
      <p><a routerLink="/">Trang chủ</a></p>
      <h1>Báo sai số liệu</h1>
      @switch (state()) {
        @case ('signin') {
          <p>Hãy đăng nhập bằng tài khoản quản trị để xem các báo cáo.</p>
          <button type="button" class="ar__btn" (click)="account.dialogOpen.set(true)">Đăng nhập</button>
        }
        @case ('forbidden') {
          <p class="ar__err" role="alert">Tài khoản này không có quyền xem báo cáo. Địa chỉ email cần nằm trong ADMIN_EMAILS của máy chủ và đã được xác minh.</p>
        }
        @case ('error') {
          <p class="ar__err" role="alert">Không tải được báo cáo. Vui lòng thử lại.</p>
        }
        @case ('loading') {
          <p>Đang tải…</p>
        }
        @default {
          <div class="ar__tabs" role="group" aria-label="Lọc theo trạng thái">
            <button type="button" [class.on]="filter() === null" [attr.aria-pressed]="filter() === null" (click)="filter.set(null)">Tất cả ({{ reports().length }})</button>
            @for (s of statuses; track s) {
              <button type="button" [class.on]="filter() === s" [attr.aria-pressed]="filter() === s" (click)="filter.set(s)">{{ label[s] }} ({{ count(s) }})</button>
            }
          </div>
          @if (!shown().length) {
            <p>Không có báo cáo nào.</p>
          }
          <ul class="ar__list">
            @for (r of shown(); track r.id) {
              <li class="ar__item" [attr.data-status]="r.status">
                <div class="ar__head">
                  <strong>
                    @if (r.kind === 'ward') {
                      <a [routerLink]="['/phuong-xa', r.target]">{{ r.targetName || r.target }}</a>
                    } @else {
                      Nguồn {{ r.targetName || r.target }}
                    }
                  </strong>
                  <small>{{ when(r.createdAt) }}@if (r.page) { · {{ r.page }} }</small>
                </div>
                <p class="ar__msg">{{ r.message }}</p>
                @if (r.contact) {
                  <p class="ar__contact">Liên hệ: {{ r.contact }}</p>
                }
                <div class="ar__actions" role="group" [attr.aria-label]="'Trạng thái của báo cáo ' + (r.targetName || r.target)">
                  @for (s of statuses; track s) {
                    <button type="button" [class.on]="r.status === s" [attr.aria-pressed]="r.status === s" [disabled]="saving() === r.id" (click)="mark(r, s)">{{ label[s] }}</button>
                  }
                </div>
              </li>
            }
          </ul>
          @if (saveError()) {
            <p class="ar__err" role="alert">{{ saveError() }}</p>
          }
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .ar { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 12px; }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 0; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    button { padding: 8px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; font-size: 13px; cursor: pointer; }
    button.on { background: var(--app-biz); border-color: var(--app-biz); color: #fff; font-weight: 700; }
    button:disabled { opacity: 0.6; cursor: progress; }
    .ar__btn { justify-self: start; background: var(--app-biz); border-color: var(--app-biz); color: #fff; font-weight: 700; }
    .ar__tabs, .ar__actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .ar__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .ar__item { padding: 12px 14px; border: 1px solid var(--app-line); border-left: 4px solid var(--app-line); border-radius: 12px; background: var(--app-surface-2); display: grid; gap: 6px; }
    .ar__item[data-status='new'] { border-left-color: var(--app-biz); }
    .ar__item[data-status='fixed'] { border-left-color: #16a34a; }
    .ar__head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
    .ar__head small, .ar__contact { color: var(--app-ink-dim); font-size: 12.5px; }
    .ar__msg { white-space: pre-wrap; overflow-wrap: anywhere; }
    .ar__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
  `,
})
export class AdminReportsComponent {
  private readonly http = inject(HttpClient);
  protected readonly account = inject(AccountService);
  protected readonly statuses = STATUSES;
  protected readonly label = STATUS_LABEL;

  protected readonly state = signal<'loading' | 'signin' | 'forbidden' | 'error' | 'ready'>('loading');
  protected readonly reports = signal<AdminReport[]>([]);
  protected readonly filter = signal<ReportStatus | null>(null);
  protected readonly saving = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly shown = computed(() => this.reports().filter((r) => !this.filter() || r.status === this.filter()));

  constructor() {
    // Loads once the account is known, and again after signing in.
    effect(() => {
      if (!this.account.ready()) return;
      const user = this.account.user();
      untracked(() => (user ? this.load() : this.state.set('signin')));
    });
  }

  protected count(status: ReportStatus): number {
    return this.reports().filter((r) => r.status === status).length;
  }

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }

  private load(): void {
    this.state.set('loading');
    this.http.get<{ reports: AdminReport[] }>(`${FEEDBACK_API_URL}/admin/reports`, { params: { limit: 500 }, withCredentials: true }).subscribe({
      next: (r) => {
        this.reports.set(r.reports);
        this.state.set('ready');
      },
      error: (e: unknown) => this.state.set(e instanceof HttpErrorResponse && e.status === 401 ? 'signin' : e instanceof HttpErrorResponse && e.status === 403 ? 'forbidden' : 'error'),
    });
  }

  protected mark(report: AdminReport, status: ReportStatus): void {
    if (report.status === status || this.saving()) return;
    this.saving.set(report.id);
    this.saveError.set(null);
    this.http.patch(`${FEEDBACK_API_URL}/admin/reports/${report.id}`, { status }, { withCredentials: true }).subscribe({
      next: () => {
        this.reports.update((list) => list.map((r) => (r.id === report.id ? { ...r, status } : r)));
        this.saving.set(null);
      },
      error: () => {
        this.saving.set(null);
        this.saveError.set('Không lưu được trạng thái. Vui lòng thử lại.');
      },
    });
  }
}
