import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FEEDBACK_API_URL } from '../../config';
import { AccountService } from '../../services/account.service';
import { AdminReport, AdminReportsComponent } from './admin-reports.component';

const REPORTS: AdminReport[] = [
  { id: 'a', kind: 'ward', target: 'phuong-tay-ho', targetName: 'Phường Tây Hồ', page: 'opportunity', message: 'Dân số sai.', contact: 'a@example.com', status: 'new', createdAt: '2026-10-27T01:00:00Z' },
  { id: 'b', kind: 'source', target: 'nso-q2-2026', targetName: null, page: null, message: 'Số thất nghiệp khác thông cáo.', contact: null, status: 'fixed', createdAt: '2026-10-26T01:00:00Z' },
];

describe('AdminReportsComponent', () => {
  let http: HttpTestingController;
  let account: AccountService;
  let fixture: ReturnType<typeof TestBed.createComponent<AdminReportsComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminReportsComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    account = TestBed.inject(AccountService);
    fixture = TestBed.createComponent(AdminReportsComponent);
  });

  const signIn = () => {
    account.user.set({ id: 'u', email: 'chu@example.com', displayName: null, createdAt: '', emailVerified: true } as never);
    account.ready.set(true);
    fixture.detectChanges();
  };

  it('asks to sign in when nobody is', () => {
    account.ready.set(true);
    fixture.detectChanges();
    fixture.detectChanges(); // the effect that decides runs during the first pass
    expect(el().textContent).toContain('Hãy đăng nhập');
    http.expectNone(`${FEEDBACK_API_URL}/admin/reports`);
  });

  it('says so when the server refuses the account', () => {
    signIn();
    http.expectOne((r) => r.url === `${FEEDBACK_API_URL}/admin/reports`).flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(el().querySelector('.ar__err')!.textContent).toContain('không có quyền');
  });

  it('lists the reports, filters by status and saves a decision', () => {
    signIn();
    http.expectOne((r) => r.url === `${FEEDBACK_API_URL}/admin/reports`).flush({ reports: REPORTS });
    fixture.detectChanges();
    expect(el().querySelectorAll('.ar__item').length).toBe(2);
    expect(el().textContent).toContain('Phường Tây Hồ');
    expect(el().textContent).toContain('Liên hệ: a@example.com');

    el().querySelectorAll<HTMLButtonElement>('.ar__tabs button')[1].click(); // Mới
    fixture.detectChanges();
    expect(el().querySelectorAll('.ar__item').length).toBe(1);

    el().querySelectorAll<HTMLButtonElement>('.ar__item .ar__actions button')[2].click(); // Đã sửa
    const req = http.expectOne(`${FEEDBACK_API_URL}/admin/reports/a`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'fixed' });
    req.flush({ ok: true });
    fixture.detectChanges();
    expect(el().querySelectorAll('.ar__item').length).toBe(0);
  });
});
