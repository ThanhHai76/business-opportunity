import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';
import { SCORE_HELP, ScoreHelpComponent } from './score-help.component';

@Component({
  standalone: true,
  imports: [ScoreHelpComponent],
  template: `<h2>Điểm <app-score-help topic="living" /></h2><p id="elsewhere">ngoài</p>`,
})
class HostComponent {}

describe('ScoreHelpComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const button = () => el().querySelector<HTMLButtonElement>('.sh__btn')!;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('is closed at first, opens on a click and shows the short answer with the link to the full one', () => {
    expect(el().querySelector('.sh__pop')).toBeNull();
    expect(button().getAttribute('aria-expanded')).toBe('false');
    button().click();
    fixture.detectChanges();
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('.sh__pop')!.textContent).toContain(SCORE_HELP.vi.text.living);
    expect(el().querySelector('.sh__pop a')!.getAttribute('href')).toBe('/giai-thich-diem#living');
  });

  it('closes with Escape, a click elsewhere and a second click on the button', () => {
    button().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el().querySelector('.sh__pop')).toBeNull();

    button().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(el().querySelector('.sh__pop')).toBeNull();

    button().click();
    fixture.detectChanges();
    button().click();
    fixture.detectChanges();
    expect(el().querySelector('.sh__pop')).toBeNull();
  });

  it('does not pass its click on to the heading or card around it', () => {
    let reached = false;
    el().querySelector('h2')!.addEventListener('click', () => (reached = true));
    button().click();
    expect(reached).toBe(false);
  });

  it('speaks English when the site does', () => {
    TestBed.inject(SiteLangService).set('en');
    fixture.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('What does this score mean?');
    button().click();
    fixture.detectChanges();
    expect(el().querySelector('.sh__pop')!.textContent).toContain(SCORE_HELP.en.text.living);
  });
});
