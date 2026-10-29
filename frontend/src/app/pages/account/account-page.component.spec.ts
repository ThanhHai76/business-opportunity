import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { FEEDBACK_API_URL } from '../../config';
import { AccountService } from '../../services/account.service';
import { AccountPageComponent } from './account-page.component';

describe('AccountPageComponent', () => {
  let http: HttpTestingController;
  let account: AccountService;
  let fixture: ReturnType<typeof TestBed.createComponent<AccountPageComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AccountPageComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    http = TestBed.inject(HttpTestingController);
    account = TestBed.inject(AccountService);
    fixture = TestBed.createComponent(AccountPageComponent);
  });

  const signIn = () => {
    account.user.set({ id: 'u', email: 'chu@example.com', displayName: 'Chủ', createdAt: '', emailVerified: true } as never);
    account.ready.set(true);
    fixture.detectChanges();
  };

  it('asks to sign in when nobody is', () => {
    account.ready.set(true);
    fixture.detectChanges();
    expect(el().textContent).toContain('Đăng nhập để mở');
    expect(el().querySelector('.ap__grid')).toBeNull();
  });

  it('shows the sections of the account, and the administration one only to an administrator', () => {
    signIn();
    http.expectOne(`${FEEDBACK_API_URL}/admin/me`).flush({ admin: false });
    fixture.detectChanges();
    const headings = Array.from(el().querySelectorAll('.ap__card h2')).map((h) => h.textContent);
    expect(headings).toContain('Hồ sơ');
    expect(headings).toContain('Bảo mật');
    expect(headings).toContain('Dữ liệu của bạn');
    expect(el().querySelector('.ap__danger summary')!.textContent).toContain('Xoá tài khoản');
    expect(headings).not.toContain('Quản trị');
    expect(el().textContent).toContain('chu@example.com');
  });

  it('shows the administration links when the server says the account is an administrator', () => {
    signIn();
    http.expectOne(`${FEEDBACK_API_URL}/admin/me`).flush({ admin: true });
    fixture.detectChanges();
    expect(el().querySelector('a[href="/admin/reports"]')).not.toBeNull();
    expect(el().querySelector('a[href="/admin/stats"]')).not.toBeNull();
  });

  it('goes home after signing out', () => {
    signIn();
    http.expectOne(`${FEEDBACK_API_URL}/admin/me`).flush({ admin: false });
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    spyOn(account, 'logout').and.returnValue({ subscribe: (o: { next: (v: unknown) => void }) => o.next(null) } as never);
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.ap__hero .ap__btn')!.click();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
