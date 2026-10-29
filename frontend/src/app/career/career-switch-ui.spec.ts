import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { CareerSwitchComponent } from './career-switch.component';
import { switchPrintHtml } from './career.switch-print';
import { EXAMPLE_INPUT, SWITCH_REFERENCES } from './career.switch';

describe('CareerSwitchComponent', () => {
  const locked = signal(true);
  const brand = signal<unknown>(null);
  const open = jasmine.createSpy('open');

  const make = (lang: 'vi' | 'en' = 'vi') => {
    localStorage.removeItem('hcv.career.switch.v1');
    TestBed.configureTestingModule({
      imports: [CareerSwitchComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BillingService, useValue: { premiumLocked: locked, brand } },
        { provide: PremiumPromptService, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(CareerSwitchComponent);
    fixture.componentRef.setInput('lang', lang);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: ReturnType<typeof make>) => f.nativeElement as HTMLElement;
  const type = (f: ReturnType<typeof make>, name: string, value: number) => {
    const input = el(f).querySelector<HTMLInputElement>(`input[name=${name}]`)!;
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
  };

  beforeEach(() => {
    locked.set(true);
    open.calls.reset();
  });
  afterEach(() => localStorage.removeItem('hcv.career.switch.v1'));

  it('asks for the income of the new work before showing a result, then shows the three cases', () => {
    const f = make();
    expect(el(f).textContent).toContain('Nhập thu nhập tháng đầu ở nghề mới');
    expect(el(f).querySelector('.sw__table')).toBeNull();
    for (const [k, v] of Object.entries({ currentIncome: 10, fees: 6, studyMonths: 3, searchMonths: 2, bridgeIncome: 2, newIncome: 15, expenses: 8 })) type(f, k, v);
    const cells = Array.from(el(f).querySelectorAll('.sw__key td')).map((td) => td.textContent!.trim());
    expect(cells[1]).toBe('15 tháng'); // the user's own numbers: pays back after 15 months
    expect(el(f).querySelector('.sw__chart')).not.toBeNull();
    expect(el(f).textContent).toContain('Thận trọng');
    expect(el(f).textContent).toContain('4,5 tháng chi tiêu');
  });

  it('keeps the numbers in the browser', () => {
    const f = make();
    type(f, 'newIncome', 12);
    f.detectChanges();
    TestBed.flushEffects();
    expect(JSON.parse(localStorage.getItem('hcv.career.switch.v1')!)[0].newIncome).toBe(12);
  });

  it('fills an example and clears it again', () => {
    const f = make();
    el(f).querySelectorAll<HTMLButtonElement>('.sw__actions button')[0].click();
    f.detectChanges();
    expect(el(f).querySelector('.sw__table')).not.toBeNull();
    el(f).querySelectorAll<HTMLButtonElement>('.sw__actions button')[1].click();
    f.detectChanges();
    expect(el(f).querySelector('.sw__table')).toBeNull();
  });

  it('lets a visitor without Premium use one option, and sends the second option and the PDF to the Premium page', () => {
    const f = make();
    el(f).querySelector<HTMLButtonElement>('.sw__opt--add')!.click();
    expect(open).toHaveBeenCalledWith('So sánh nhiều hướng chuyển nghề', 'vi');
    expect(el(f).querySelectorAll('.sw__opt').length).toBe(2); // the one option and the add button
    el(f).querySelector<HTMLButtonElement>('.sw__btn--premium')!.click();
    expect(open).toHaveBeenCalledWith('Xuất PDF lộ trình chuyển nghề', 'vi');
  });

  it('lets Premium compare up to three options', () => {
    locked.set(false);
    const f = make();
    type(f, 'newIncome', 15);
    el(f).querySelector<HTMLButtonElement>('.sw__opt--add')!.click();
    f.detectChanges();
    type(f, 'newIncome', 20);
    expect(el(f).querySelector('.sw__compare')).not.toBeNull();
    el(f).querySelector<HTMLButtonElement>('.sw__opt--add')!.click();
    f.detectChanges();
    expect(el(f).querySelector('.sw__opt--add')).toBeNull(); // three is the most
    expect(open).not.toHaveBeenCalled();
  });

  it('names the first option after the direction the visitor came from, without overwriting a name already typed', () => {
    const f = make();
    f.componentRef.setInput('suggestedName', 'Công nghệ cao và bán dẫn');
    f.detectChanges();
    const input = el(f).querySelector<HTMLInputElement>('input[type=text]')!;
    expect(input.value).toBe('Công nghệ cao và bán dẫn');
    input.value = 'Tên của tôi';
    input.dispatchEvent(new Event('input'));
    f.componentRef.setInput('suggestedName', 'Logistics');
    f.detectChanges();
    expect(el(f).querySelector<HTMLInputElement>('input[type=text]')!.value).toBe('Tên của tôi');
  });

  it('speaks English when the page does', () => {
    const f = make('en');
    expect(el(f).textContent).toContain('The career-change calculator');
    expect(el(f).textContent).toContain('Sourced figures for reference');
  });

  it('shows the sourced reference points with links and no figure of its own', () => {
    const f = make();
    const links = el(f).querySelectorAll('.sw__refs a[href^="https://"]');
    expect(links.length).toBeGreaterThanOrEqual(SWITCH_REFERENCES.length);
    expect(el(f).textContent).toContain('dự thảo');
  });
});

describe('the printed career-change plan', () => {
  const html = (over = {}) => switchPrintHtml({ options: [{ ...EXAMPLE_INPUT, name: 'Học <kế toán>' }], generatedAt: new Date(2026, 9, 28), brand: null, references: SWITCH_REFERENCES, ...over });

  it('prints the numbers, the three cases, the chart, the sources and the disclaimer, with the name escaped', () => {
    const page = html();
    expect(page).toContain('Học &lt;kế toán&gt;');
    expect(page).not.toContain('Học <kế toán>');
    expect(page).toContain('15 tháng');
    expect(page).toContain('<svg');
    expect(page).toContain('https://www.nso.gov.vn/');
    expect(page).toContain('không phải dự báo thu nhập');
    expect(page).toContain('Hanoi Century Vista');
  });

  it('puts the details of the person who made it on the sheet (Premium) and compares several options', () => {
    const page = html({
      brand: { company: 'Trung tâm Việc làm A', name: 'Nguyễn B', phone: '0900000000', email: 'b@example.com', note: '' },
      options: [EXAMPLE_INPUT, { ...EXAMPLE_INPUT, name: 'Hướng hai', newIncome: 20 }],
    });
    expect(page).toContain('Trung tâm Việc làm A');
    expect(page).toContain('Hướng hai');
    expect(page).toContain('So sánh các hướng');
  });

  it('is in English on request', () => {
    expect(html({ lang: 'en' })).toContain('Career-change plan');
  });
});
