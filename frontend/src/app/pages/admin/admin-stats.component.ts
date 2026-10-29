import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ANALYTICS_API_URL } from '../../config';
import { AccountService } from '../../services/account.service';
import { StatRow, summarize } from './stats';

interface SummaryResponse {
  since: string;
  days: number;
  rows: StatRow[];
}

const PERIODS = [7, 30, 90];
const CARDS: [string, string][] = [
  ['page_view', 'Lượt xem trang'],
  ['signup', 'Đăng ký mới'],
  ['ward_lookup', 'Tra cứu phường/xã'],
  ['score_help', 'Mở dấu "?" giải thích điểm'],
  ['sample_report', 'Mở báo cáo mẫu'],
  ['checkout_start', 'Bắt đầu thanh toán'],
  ['order_paid', 'Thanh toán thành công'],
];

/**
 * /admin/stats: the site's own visit counters (backend-node src/analytics) for the person who runs it.
 * Counters only: there is nothing about any visitor here. The server decides who may read them (ADMIN_EMAILS).
 */
@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="as">
      <p><a routerLink="/">Trang chủ</a></p>
      <h1>Thống kê truy cập</h1>
      @switch (state()) {
        @case ('signin') {
          <p>Hãy đăng nhập bằng tài khoản quản trị để xem thống kê.</p>
          <button type="button" class="as__btn" (click)="account.dialogOpen.set(true)">Đăng nhập</button>
        }
        @case ('forbidden') {
          <p class="as__err" role="alert">Tài khoản này không có quyền xem thống kê. Địa chỉ email cần nằm trong ADMIN_EMAILS của máy chủ và đã được xác minh.</p>
        }
        @case ('error') {
          <p class="as__err" role="alert">Không tải được thống kê. Vui lòng thử lại.</p>
        }
        @case ('loading') {
          <p>Đang tải…</p>
        }
        @default {
          <div class="as__period" role="group" aria-label="Khoảng thời gian">
            @for (p of periods; track p) {
              <button type="button" [class.on]="days() === p" [attr.aria-pressed]="days() === p" (click)="days.set(p)">{{ p }} ngày</button>
            }
          </div>
          <p class="as__note">Từ {{ since() }}. Chỉ là bộ đếm: trang không lưu địa chỉ IP, cookie hay tài khoản của người truy cập. Trình duyệt bật "Do Not Track" không được đếm. Ngày tính theo giờ Việt Nam.</p>

          <ul class="as__cards">
            @for (c of cards; track c[0]) {
              <li><span>{{ c[1] }}</span><strong>{{ num(data().totals[c[0]] ?? 0) }}</strong></li>
            }
          </ul>

          <section aria-labelledby="as-funnel">
            <h2 id="as-funnel">Từ trang Premium đến thanh toán</h2>
            <ol class="as__funnel">
              @for (f of data().funnel; track f.label) {
                <li>
                  <span>{{ f.label }}</span>
                  <strong>{{ num(f.n) }}</strong>
                  <small>{{ f.pct === null ? '' : f.pct + '% của bước trước' }}</small>
                </li>
              }
            </ol>
            @if (data().paidByProduct.length) {
              <p class="as__note">Đã thanh toán theo gói: @for (p of data().paidByProduct; track p.product) { <b>{{ p.product }}</b> {{ p.n }}{{ $last ? '' : ' · ' }} }</p>
            }
          </section>

          <section aria-labelledby="as-daily">
            <h2 id="as-daily">Lượt xem mỗi ngày</h2>
            <ul class="as__bars" aria-label="Lượt xem trang mỗi ngày">
              @for (d of data().daily; track d.day) {
                <li [title]="d.day + ': ' + d.n"><i [style.height.%]="barHeight(d.n)"></i></li>
              }
            </ul>
          </section>

          <section aria-labelledby="as-pages">
            <h2 id="as-pages">Trang được xem nhiều nhất</h2>
            @if (!data().pages.length) {
              <p>Chưa có lượt xem nào trong khoảng này.</p>
            } @else {
              <table class="as__table">
                <thead><tr><th scope="col">Trang</th><th scope="col">Lượt xem</th></tr></thead>
                <tbody>
                  @for (p of data().pages.slice(0, 20); track p.path) {
                    <tr><td>{{ p.path }}</td><td>{{ num(p.n) }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .as { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; display: grid; gap: 14px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p, ul, ol { margin: 0; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    button { padding: 8px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; font-size: 13px; cursor: pointer; }
    button.on { background: var(--app-biz); border-color: var(--app-biz); color: #fff; font-weight: 700; }
    .as__btn { justify-self: start; background: var(--app-biz); border-color: var(--app-biz); color: #fff; font-weight: 700; }
    .as__period { display: flex; gap: 6px; }
    .as__note { color: var(--app-ink-dim); font-size: 13px; }
    .as__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
    .as__cards { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .as__cards li { padding: 12px 14px; border: 1px solid var(--app-line); border-radius: 12px; background: var(--app-surface-2); display: grid; gap: 2px; }
    .as__cards span { font-size: 12.5px; color: var(--app-ink-dim); }
    .as__cards strong { font-size: 24px; }
    .as__funnel { list-style: none; padding: 0; display: grid; gap: 6px; }
    .as__funnel li { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: baseline; padding: 8px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); }
    .as__funnel small { color: var(--app-ink-dim); min-width: 120px; text-align: right; }
    .as__bars { list-style: none; padding: 0; height: 90px; display: flex; align-items: flex-end; gap: 2px; }
    .as__bars li { flex: 1; height: 100%; display: flex; align-items: flex-end; }
    .as__bars i { display: block; width: 100%; min-height: 2px; background: var(--app-biz); border-radius: 2px 2px 0 0; }
    .as__table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .as__table th, .as__table td { padding: 6px 8px; border-bottom: 1px solid var(--app-line); text-align: left; }
    .as__table td:last-child, .as__table th:last-child { text-align: right; }
  `,
})
export class AdminStatsComponent {
  private readonly http = inject(HttpClient);
  protected readonly account = inject(AccountService);
  protected readonly periods = PERIODS;
  protected readonly cards = CARDS;

  protected readonly state = signal<'loading' | 'signin' | 'forbidden' | 'error' | 'ready'>('loading');
  protected readonly days = signal(30);
  protected readonly since = signal('');
  private readonly rows = signal<StatRow[]>([]);
  protected readonly data = computed(() => summarize(this.rows(), this.since(), new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)));
  private readonly peak = computed(() => Math.max(1, ...this.data().daily.map((d) => d.n)));

  constructor() {
    // Loads once the account is known, again after signing in and when the period changes.
    effect(() => {
      if (!this.account.ready()) return;
      const user = this.account.user();
      const days = this.days();
      untracked(() => (user ? this.load(days) : this.state.set('signin')));
    });
  }

  protected num(n: number): string {
    return n.toLocaleString('vi-VN');
  }

  protected barHeight(n: number): number {
    return Math.round((n / this.peak()) * 100);
  }

  private load(days: number): void {
    this.http.get<SummaryResponse>(`${ANALYTICS_API_URL}/admin/summary`, { params: { days }, withCredentials: true }).subscribe({
      next: (r) => {
        this.since.set(r.since);
        this.rows.set(r.rows);
        this.state.set('ready');
      },
      error: (e: unknown) => this.state.set(e instanceof HttpErrorResponse && e.status === 401 ? 'signin' : e instanceof HttpErrorResponse && e.status === 403 ? 'forbidden' : 'error'),
    });
  }
}
