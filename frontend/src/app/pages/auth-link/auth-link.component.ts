import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService, accountError } from '../../services/account.service';

type Mode = 'forgot' | 'reset' | 'verify';

/**
 * The pages the emails point to, and the one that asks for the email:
 *   /forgot-password           ask for a reset link
 *   /reset-password?token=…    choose a new password
 *   /verify-email?token=…      confirm the address (done on load)
 */
@Component({
  selector: 'app-auth-link',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="al">
      @switch (mode) {
        @case ('forgot') {
          <h1>Quên mật khẩu</h1>
          @if (sent()) {
            <p class="al__ok" role="status">Nếu email này có tài khoản, chúng tôi vừa gửi một liên kết đặt lại mật khẩu (hiệu lực 1 giờ). Hãy kiểm tra hộp thư, kể cả thư rác.</p>
          } @else if (account.ready() && !account.mail()) {
            <p class="al__err">Máy chủ này chưa bật gửi email, nên chưa thể đặt lại mật khẩu tự động.</p>
          } @else {
            <p>Nhập email đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
            <form (submit)="$event.preventDefault(); forgot()">
              <label><span>Email</span><input type="email" name="email" autocomplete="email" required maxlength="254" (input)="email.set($any($event.target).value)" /></label>
              <button type="submit" [disabled]="busy()">{{ busy() ? 'Đang gửi…' : 'Gửi liên kết' }}</button>
            </form>
          }
        }
        @case ('reset') {
          <h1>Đặt mật khẩu mới</h1>
          @if (finished()) {
            <p class="al__ok" role="status">Đã đổi mật khẩu. Bạn đã được đăng xuất khỏi mọi thiết bị.</p>
            <button type="button" (click)="account.dialogOpen.set(true)">Đăng nhập</button>
          } @else if (!token) {
            <p class="al__err">Liên kết không hợp lệ. <a routerLink="/forgot-password">Yêu cầu liên kết mới</a>.</p>
          } @else {
            <form (submit)="$event.preventDefault(); reset()">
              <label><span>Mật khẩu mới (ít nhất 8 ký tự)</span><input type="password" name="password" autocomplete="new-password" minlength="8" required (input)="password.set($any($event.target).value)" /></label>
              <button type="submit" [disabled]="busy()">{{ busy() ? 'Đang lưu…' : 'Đổi mật khẩu' }}</button>
            </form>
          }
        }
        @case ('verify') {
          <h1>Xác minh email</h1>
          @if (finished()) {
            <p class="al__ok" role="status">Email của bạn đã được xác minh. Cảm ơn bạn!</p>
          } @else if (!error()) {
            <p>Đang xác minh…</p>
          }
        }
      }
      @if (error(); as e) {
        <p class="al__err" role="alert">{{ e }}</p>
        @if (mode === 'forgot') {
          <!-- nothing: the form stays -->
        } @else if (mode === 'reset') {
          <p><a routerLink="/forgot-password">Yêu cầu liên kết mới</a></p>
        } @else {
          <p>Đăng nhập rồi chọn “Gửi lại email xác minh” trong mục Tài khoản.</p>
        }
      }
      <p class="al__back"><a routerLink="/">← Về trang chủ</a></p>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .al { max-width: 440px; margin: 0 auto; padding: 48px 16px; display: grid; gap: 14px; }
    h1 { margin: 0; font-size: 26px; }
    p { margin: 0; }
    form { display: grid; gap: 12px; }
    label { display: grid; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--app-ink-dim); }
    input { padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: var(--app-ink); font: inherit; }
    button { justify-self: start; padding: 10px 16px; border: 0; border-radius: 10px; background: var(--app-biz); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: progress; }
    a { color: var(--app-biz); font-weight: 700; text-decoration: none; }
    .al__ok { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #16a34a 12%, transparent); }
    .al__err { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, #dc2626 12%, transparent); color: #dc2626; }
    .al__back { margin-top: 12px; }
  `,
})
export class AuthLinkComponent implements OnInit {
  protected readonly account = inject(AccountService);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode: Mode = this.route.snapshot.data['mode'];
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly finished = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.mode !== 'verify') return;
    if (!this.token) {
      this.error.set('Liên kết không hợp lệ hoặc đã hết hạn.');
      return;
    }
    this.account.verifyEmail(this.token).subscribe({
      next: () => this.finished.set(true),
      error: (e: unknown) => this.error.set(accountError(e)),
    });
  }

  protected forgot(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.account.forgotPassword(this.email().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }

  protected reset(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.account.resetPassword(this.token, this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        this.finished.set(true);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }
}
