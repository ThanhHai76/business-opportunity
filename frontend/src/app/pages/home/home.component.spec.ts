import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { HomeComponent, INTENTS } from './home.component';

describe('Home page quick start', () => {
  it('points every need at a tool that exists, once each', () => {
    const known = new Set(routes.map((r) => `/${r.path}`));
    for (const i of INTENTS) expect(known.has(i.path)).withContext(i.id).toBeTrue();
    expect(new Set(INTENTS.map((i) => i.path)).size).toBe(INTENTS.length);
  });

  it('shows one link per need, in the visitor\'s words', () => {
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.intents-list a.intent'));
    expect(links.length).toBe(INTENTS.length);
    expect(links.map((a) => a.querySelector('strong')?.textContent?.trim())).toEqual(INTENTS.map((i) => i.want));
    expect(links.every((a) => a.getAttribute('href')?.startsWith('/'))).toBeTrue();
  });
});
