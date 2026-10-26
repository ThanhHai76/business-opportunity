import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FEEDBACK_API_URL } from '../../config';
import { ReportIssueComponent } from './report-issue.component';

@Component({
  standalone: true,
  imports: [ReportIssueComponent],
  template: `<app-report-issue kind="ward" [target]="target()" targetName="Phường Tây Hồ" page="opportunity" [lang]="lang()" />`,
})
class HostComponent {
  readonly target = signal('phuong-tay-ho');
  readonly lang = signal<'vi' | 'en'>('vi');
}

describe('ReportIssueComponent ("Báo sai số liệu")', () => {
  let http: HttpTestingController;
  let host: HostComponent;
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('opens a form from the button, in the language of the page', () => {
    expect(el.querySelector('.ri__open')?.textContent).toContain('Báo sai số liệu');
    click('.ri__open');
    expect(el.querySelector('form')).not.toBeNull();
    expect(el.textContent).toContain('Phường Tây Hồ');
    host.lang.set('en');
    fixture.detectChanges();
    expect(el.textContent).toContain('Report a data error');
  });

  it('refuses a message that is too short without calling the server', () => {
    click('.ri__open');
    type('textarea', 'sai');
    submit();
    expect(el.querySelector('.ri__err')?.textContent).toContain('10 ký tự');
    http.expectNone(`${FEEDBACK_API_URL}/data-report`);
  });

  it('sends the report about the ward, then thanks the visitor', () => {
    click('.ri__open');
    type('textarea', 'Dân số ghi sai, danh sách chính thức là khác.');
    type('input[name=contact]', 'a@example.com');
    submit();
    const req = http.expectOne(`${FEEDBACK_API_URL}/data-report`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'ward', target: 'phuong-tay-ho', targetName: 'Phường Tây Hồ', page: 'opportunity', message: 'Dân số ghi sai, danh sách chính thức là khác.', contact: 'a@example.com' });
    req.flush({ ok: true, id: 'x' });
    fixture.detectChanges();
    expect(el.querySelector('.ri__ok')?.textContent).toContain('Cảm ơn');
  });

  it('says so when the visitor has sent too many, and keeps what they wrote', () => {
    click('.ri__open');
    type('textarea', 'Số liệu này sai hoàn toàn nhé.');
    submit();
    http.expectOne(`${FEEDBACK_API_URL}/data-report`).flush({ code: 'rate_limited' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(el.querySelector('.ri__err')?.textContent).toContain('nhiều báo cáo');
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Số liệu này sai hoàn toàn nhé.');
  });

  it('starts again when the ward changes', () => {
    click('.ri__open');
    type('textarea', 'Số liệu này sai hoàn toàn nhé.');
    host.target.set('phuong-cau-giay');
    fixture.detectChanges();
    fixture.detectChanges(); // the effect that clears the form runs after the first pass
    expect(el.querySelector('form')).toBeNull();
    click('.ri__open');
    expect((el.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
  });

  it('hides a trap field for bots from people, and sends it only when filled', () => {
    click('.ri__open');
    const trap = el.querySelector('.ri__trap') as HTMLElement;
    expect(trap.getAttribute('aria-hidden')).toBe('true');
    type('textarea', 'Số liệu này sai hoàn toàn nhé.');
    type('input[name=website]', 'http://spam.example');
    submit();
    expect(http.expectOne(`${FEEDBACK_API_URL}/data-report`).request.body.website).toBe('http://spam.example');
  });
});
