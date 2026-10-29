import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { ACCOUNT_API_URL } from '../config';
import { ERROR_EN } from '../components/account/account.i18n';
import { track } from './analytics';
import { siteLangNow } from './site-lang.service';

export interface AccountUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  /** The address was confirmed through the link sent by email. */
  emailVerified: boolean;
}

/** The session is an HttpOnly cookie: every call sends it (withCredentials), the page never sees the token. */
const opts = { withCredentials: true } as const;

/** A readable message for an accounts API error (the server answers { code, message } in Vietnamese). */
export function accountError(error: unknown): string {
  const en = siteLangNow() === 'en';
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return en ? 'Cannot reach the server. Check your connection and try again.' : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    const body = error.error as { message?: unknown; code?: unknown } | null;
    // The server's messages are in Vietnamese: a reader of English gets the meaning of its code.
    if (en && typeof body?.code === 'string' && ERROR_EN[body.code]) return ERROR_EN[body.code];
    if (typeof body?.message === 'string' && !en) return body.message;
  }
  return en ? 'Something went wrong. Please try again.' : 'Có lỗi xảy ra, vui lòng thử lại.';
}

/**
 * Who is signed in (backend-node /api/account, PostgreSQL). `enabled` is false when the server has no database:
 * the account menu is then hidden and every page keeps working with browser storage only.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  readonly enabled = signal(false);
  readonly user = signal<AccountUser | null>(null);
  /** The server can send email (verify an address, reset a password). */
  readonly mail = signal(false);
  /** The first /me answer has arrived (until then the menu shows nothing rather than a wrong state). */
  readonly ready = signal(false);
  /** The sign-in dialog (opened from the header, or from a page that offers to keep things in the account). */
  readonly dialogOpen = signal(false);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.http.get<{ enabled: boolean; mail?: boolean; user: AccountUser | null }>(`${ACCOUNT_API_URL}/me`, opts).subscribe({
      next: (r) => {
        this.enabled.set(r.enabled);
        this.mail.set(Boolean(r.mail));
        this.user.set(r.user);
        this.ready.set(true);
      },
      error: () => {
        // Old backend without /api/account, or offline: behave as "accounts off".
        this.enabled.set(false);
        this.mail.set(false);
        this.user.set(null);
        this.ready.set(true);
      },
    });
  }

  register(email: string, password: string, displayName: string, acceptTerms = false): Observable<AccountUser> {
    return this.http
      .post<{ user: AccountUser }>(`${ACCOUNT_API_URL}/register`, { email, password, ...(displayName.trim() ? { displayName } : {}), ...(acceptTerms ? { acceptTerms: true } : {}) }, opts)
      .pipe(map((r) => r.user), tap((u) => this.user.set(u)), tap(() => track('signup')));
  }

  login(email: string, password: string): Observable<AccountUser> {
    return this.http.post<{ user: AccountUser }>(`${ACCOUNT_API_URL}/login`, { email, password }, opts).pipe(map((r) => r.user), tap((u) => this.user.set(u)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${ACCOUNT_API_URL}/logout`, null, opts).pipe(tap(() => this.user.set(null)));
  }

  updateName(displayName: string): Observable<AccountUser> {
    return this.http.patch<{ user: AccountUser }>(`${ACCOUNT_API_URL}/me`, { displayName }, opts).pipe(map((r) => r.user), tap((u) => this.user.set(u)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${ACCOUNT_API_URL}/me/password`, { currentPassword, newPassword }, opts);
  }

  forgotPassword(email: string): Observable<unknown> {
    return this.http.post(`${ACCOUNT_API_URL}/forgot-password`, { email }, opts);
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>(`${ACCOUNT_API_URL}/reset-password`, { token, password }, opts);
  }

  /** Confirms the address from the emailed link; refreshes the signed-in user so the banner goes away. */
  verifyEmail(token: string): Observable<unknown> {
    return this.http.post(`${ACCOUNT_API_URL}/verify-email`, { token }, opts).pipe(tap(() => this.refresh()));
  }

  resendVerification(): Observable<unknown> {
    return this.http.post(`${ACCOUNT_API_URL}/verify-email/send`, null, opts);
  }

  /** Everything the account holds (the password is asked again). The page saves it as a file: see downloadJson(). */
  exportData(password: string): Observable<unknown> {
    return this.http.post<unknown>(`${ACCOUNT_API_URL}/me/export`, { password }, opts);
  }

  deleteAccount(password: string): Observable<void> {
    return this.http.delete<void>(`${ACCOUNT_API_URL}/me`, { ...opts, body: { password } }).pipe(tap(() => this.user.set(null)));
  }
}
