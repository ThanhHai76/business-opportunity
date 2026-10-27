import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { HomeComponent } from './home.component';
import { SiteLangService } from '../../services/site-lang.service';
import { HOME_TEXT } from './home.i18n';

describe('Home page quick start', () => {
  it('points every need at a tool that exists, once each', () => {
    const known = new Set(routes.map((r) => `/${r.path}`));
    for (const i of HOME_TEXT.vi.intents) expect(known.has(i.path)).withContext(i.id).toBeTrue();
    expect(new Set(HOME_TEXT.vi.intents.map((i) => i.path)).size).toBe(HOME_TEXT.vi.intents.length);
  });

  it('shows one link per need, in the visitor\'s words', () => {
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.intents-list a.intent'));
    expect(links.length).toBe(HOME_TEXT.vi.intents.length);
    expect(links.map((a) => a.querySelector('strong')?.textContent?.trim())).toEqual(HOME_TEXT.vi.intents.map((i) => i.want));
    expect(links.every((a) => a.getAttribute('href')?.startsWith('/'))).toBeTrue();
  });
});
