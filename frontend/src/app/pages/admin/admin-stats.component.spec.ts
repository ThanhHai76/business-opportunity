import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ANALYTICS_API_URL } from '../../config';
import { AccountService } from '../../services/account.service';
import { AdminStatsComponent } from './admin-stats.component';

describe('AdminStatsComponent', () => {
  let http: HttpTestingController;
  let account: AccountService;
  let fixture: ReturnType<typeof TestBed.createComponent<AdminStatsComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const url = `${ANALYTICS_API_URL}/admin/summary`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminStatsComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    account = TestBed.inject(AccountService);
    fixture = TestBed.createComponent(AdminStatsComponent);
  });

  const signIn = () => {
    account.user.set({ id: 'u', email: 'chu@example.com', displayName: null, createdAt: '', emailVerified: true } as never);
    account.ready.set(true);
    fixture.detectChanges();
  };

  it('asks to sign in when nobody is', () => {
    account.ready.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(el().textContent).toContain('Hãy đăng nhập');
    http.expectNone((r) => r.url === url);
  });

  it('says so when the server refuses the account', () => {
    signIn();
    http.expectOne((r) => r.url === url).flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el().querySelector('.as__err')!.textContent).toContain('không có quyền');
  });

  it('shows the totals, the funnel and the pages, and asks again for another period', () => {
    signIn();
    const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
    http.expectOne((r) => r.url === url && r.params.get('days') === '30').flush({
      since: today,
      days: 30,
      rows: [
        { day: today, event: 'page_view', key: '/premium', n: 10 },
        { day: today, event: 'page_view', key: '/', n: 5 },
        { day: today, event: 'checkout_start', key: 'premium-month', n: 2 },
        { day: today, event: 'order_paid', key: 'premium-month', n: 1 },
      ],
    });
    fixture.detectChanges();
    const cards = Array.from(el().querySelectorAll('.as__cards li')).map((li) => [li.querySelector('span')!.textContent, li.querySelector('strong')!.textContent]);
    expect(cards[0]).toEqual(['Lượt xem trang', '15']);
    expect(cards).toContain(['Thanh toán thành công', '1']);
    expect(el().querySelector('.as__funnel')!.textContent).toContain('20% của bước trước');
    expect(el().querySelector('.as__table tbody tr')!.textContent).toContain('/premium');
    expect(el().textContent).toContain('không lưu địa chỉ IP');

    el().querySelectorAll<HTMLButtonElement>('.as__period button')[0].click(); // 7 days
    fixture.detectChanges();
    http.expectOne((r) => r.url === url && r.params.get('days') === '7').flush({ since: today, days: 7, rows: [] });
    fixture.detectChanges();
    expect(el().textContent).toContain('Chưa có lượt xem nào');
  });
});
