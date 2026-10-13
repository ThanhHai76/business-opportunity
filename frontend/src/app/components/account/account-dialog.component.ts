import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountService, accountError } from '../../services/account.service';

type View = 'login' | 'register' | 'account';

/**
 * Sign in / sign up, and — once signed in — the account: name, password, sign out, delete the account.
 * Shown by the site header while AccountService.dialogOpen() is true.
 */
@Component({
  selector: 'app-account-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-backdrop" (click)="close()"></div>
    <div class="ad" role="dialog" aria-modal="true" aria-labelledby="ad-title">
      <div class="ad__head">
        <h2 id="ad-title">{{ account.user() ? 'Tài khoản' : view() === 'register' ? 'Tạo tài khoản' : 'Đăng nhập' }}</h2>
        <button type="button" class="ad__x" (click)="close()" aria-label="Đóng">✕</button>
      </div>

      @if (account.user(); as u) {
        <p class="ad__who">
          <strong>{{ u.displayName || u.email }}</strong>
          @if (u.displayName) {
            <small>{{ u.email }}</small>
          }
        </p>
        <p class="ad__note">Báo cáo bạn lưu trên Bản đồ cơ hội kinh doanh được giữ trong tài khoản này và mở được trên mọi thiết bị.</p>

        <form class="ad__form" (submit)="$event.preventDefault(); saveName()">
          <label>
            <span>Tên hiển thị</span>
            <input type="text" name="name" maxlength="80" autocomplete="nickname" [value]="u.displayName ?? ''" (input)="name.set($any($event.target).value)" />
          </label>
          <button type="submit" class="ad__btn" [disabled]="busy()">Lưu tên</button>
        </form>

        <details class="ad__more">
          <summary>Đổi mật khẩu</summary>
          <form class="ad__form" (submit)="$event.preventDefault(); changePassword()">
            <label>
              <span>Mật khẩu hiện tại</span>
              <input type="password" name="current" autocomplete="current-password" required (input)="password.set($any($event.target).value)" />
            </label>
            <label>
              <span>Mật khẩu mới (ít nhất 8 ký tự)</span>
              <input type="password" name="new" autocomplete="new-password" minlength="8" required (input)="newPassword.set($any($event.target).value)" />
            </label>
            <button type="submit" class="ad__btn" [disabled]="busy()">Đổi mật khẩu</button>
            <small class="ad__hint">Các thiết bị khác đang đăng nhập sẽ bị đăng xuất.</small>
          </form>
        </details>

        <details class="ad__more ad__danger">
          <summary>Xoá tài khoản</summary>
          <form class="ad__form" (submit)="$event.preventDefault(); deleteAccount()">
            <p class="ad__hint">Xoá vĩnh viễn tài khoản và mọi báo cáo đã lưu. Không thể khôi phục.</p>
            <label>
              <span>Nhập mật khẩu để xác nhận</span>
              <input type="password" name="confirm" autocomplete="current-password" required (input)="password.set($any($event.target).value)" />
            </label>
            <button type="submit" class="ad__btn ad__btn--danger" [disabled]="busy()">Xoá tài khoản</button>
          </form>
        </details>

        <button type="button" class="ad__btn ad__btn--primary" (click)="logout()" [disabled]="busy()">Đăng xuất</button>
      } @else {
        <p class="ad__note">
          {{ view() === 'register' ? 'Tạo tài khoản để giữ báo cáo đã lưu trên mọi thiết bị. Báo cáo đang có trong trình duyệt này sẽ được chuyển vào tài khoản.' : 'Đăng nhập để mở các báo cáo đã lưu trên mọi thiết bị.' }}
        </p>
        <form class="ad__form" (submit)="$event.preventDefault(); submit()">
          @if (view() === 'register') {
            <label>
              <span>Tên hiển thị (không bắt buộc)</span>
              <input type="text" name="name" maxlength="80" autocomplete="nickname" (input)="name.set($any($event.target).value)" />
            </label>
          }
          <label>
            <span>Email</span>
            <input #first type="email" name="email" autocomplete="email" required maxlength="254" (input)="email.set($any($event.target).value)" />
          </label>
          <label>
            <span>Mật khẩu{{ view() === 'register' ? ' (ít nhất 8 ký tự)' : '' }}</span>
            <input
              type="password"
              name="password"
              required
              [attr.minlength]="view() === 'register' ? 8 : null"
              [attr.autocomplete]="view() === 'register' ? 'new-password' : 'current-password'"
              (input)="password.set($any($event.target).value)"
            />
          </label>
          <button type="submit" class="ad__btn ad__btn--primary" [disabled]="busy()">
            {{ busy() ? 'Đang xử lý…' : view() === 'register' ? 'Tạo tài khoản' : 'Đăng nhập' }}
          </button>
        </form>
        <p class="ad__switch">
          @if (view() === 'register') {
            Đã có tài khoản? <button type="button" (click)="switchTo('login')">Đăng nhập</button>
          } @else {
            Chưa có tài khoản? <button type="button" (click)="switchTo('register')">Tạo tài khoản</button>
          }
        </p>
      }

      @if (error(); as e) {
        <p class="ad__error" role="alert">{{ e }}</p>
      }
      @if (done(); as d) {
        <p class="ad__done" role="status">{{ d }}</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .ad-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(10, 8, 5, 0.45);
      }
      .ad {
        position: relative;
        width: min(400px, 100%);
        max-height: calc(100dvh - 32px);
        overflow-y: auto;
        display: grid;
        gap: 12px;
        padding: 20px;
        border: 1px solid var(--app-line);
        border-radius: 16px;
        background: var(--app-surface);
        color: var(--app-ink);
        box-shadow: var(--app-shadow);
        font: 14px/1.45 'Manrope', -apple-system, 'Segoe UI', sans-serif;
      }
      .ad__head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h2 {
        margin: 0;
        font-size: 18px;
      }
      .ad__x {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--app-ink-dim);
        cursor: pointer;
      }
      .ad__x:hover {
        background: var(--app-surface-2);
      }
      .ad__note,
      .ad__hint {
        margin: 0;
        color: var(--app-ink-dim);
        font-size: 13px;
      }
      .ad__who {
        margin: 0;
        display: grid;
      }
      .ad__who small {
        color: var(--app-ink-dim);
      }
      .ad__form {
        display: grid;
        gap: 10px;
      }
      label {
        display: grid;
        gap: 4px;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--app-ink-dim);
      }
      input {
        padding: 9px 11px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface-2);
        color: var(--app-ink);
        font: inherit;
        font-weight: 500;
      }
      input:focus-visible {
        outline: 2px solid var(--app-biz);
        outline-offset: 1px;
      }
      .ad__btn {
        padding: 9px 14px;
        border: 1px solid var(--app-line);
        border-radius: 10px;
        background: var(--app-surface);
        color: var(--app-ink);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .ad__btn--primary {
        border-color: transparent;
        background: var(--app-biz);
        color: #fff;
      }
      .ad__btn--danger {
        border-color: #dc2626;
        color: #dc2626;
      }
      .ad__btn:disabled {
        opacity: 0.6;
        cursor: progress;
      }
      .ad__more summary {
        cursor: pointer;
        font-weight: 700;
        font-size: 13px;
      }
      .ad__more[open] summary {
        margin-bottom: 8px;
      }
      .ad__danger summary {
        color: #dc2626;
      }
      .ad__switch {
        margin: 0;
        font-size: 13px;
        color: var(--app-ink-dim);
      }
      .ad__switch button {
        padding: 0;
        border: 0;
        background: none;
        color: var(--app-biz);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .ad__error {
        margin: 0;
        padding: 8px 10px;
        border-radius: 8px;
        background: color-mix(in srgb, #dc2626 12%, transparent);
        color: #dc2626;
        font-size: 13px;
      }
      .ad__done {
        margin: 0;
        color: var(--app-ink-dim);
        font-size: 13px;
      }
    `,
  ],
})
export class AccountDialogComponent implements AfterViewInit {
  protected readonly account = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly view = signal<View>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly newPassword = signal('');
  protected readonly name = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<string | null>(null);

  constructor() {
    this.name.set(this.account.user()?.displayName ?? '');
  }

  ngAfterViewInit(): void {
    this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus();
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.account.dialogOpen.set(false);
  }

  protected switchTo(view: View): void {
    this.view.set(view);
    this.error.set(null);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('input')?.focus());
  }

  private run(call: Observable<unknown>, onDone: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.done.set(null);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        onDone();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(accountError(e));
      },
    });
  }

  protected submit(): void {
    const email = this.email().trim();
    const password = this.password();
    const call = this.view() === 'register' ? this.account.register(email, password, this.name()) : this.account.login(email, password);
    this.run(call, () => this.close());
  }

  protected saveName(): void {
    this.run(this.account.updateName(this.name()), () => this.done.set('Đã lưu tên.'));
  }

  protected changePassword(): void {
    this.run(this.account.changePassword(this.password(), this.newPassword()), () => this.done.set('Đã đổi mật khẩu.'));
  }

  protected deleteAccount(): void {
    if (!confirm('Xoá vĩnh viễn tài khoản và mọi báo cáo đã lưu?')) return;
    this.run(this.account.deleteAccount(this.password()), () => this.close());
  }

  protected logout(): void {
    this.run(this.account.logout(), () => this.close());
  }
}
