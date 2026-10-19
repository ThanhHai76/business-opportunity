import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SITE_URL } from '../config';
import { ROUTE_DESCRIPTIONS, SeoService } from './seo.service';

describe('SeoService', () => {
  let seo: SeoService;
  const tag = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    seo = TestBed.inject(SeoService);
  });

  it('sets the description, canonical link and share tags for a route', () => {
    seo.apply('/time-machine?lang=en#top');
    expect(tag('meta[name="description"]')).toBe(ROUTE_DESCRIPTIONS['time-machine']);
    expect(tag('meta[property="og:url"]')).toBe(`${SITE_URL}/time-machine`);
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_URL}/time-machine`);
    expect(tag('meta[name="robots"]')).toBe('index, follow');
  });

  it('keeps the links from emails and password pages out of search results', () => {
    seo.apply('/reset-password?token=abc');
    expect(tag('meta[name="robots"]')).toBe('noindex, nofollow');
    seo.apply('/');
    expect(tag('meta[name="robots"]')).toBe('index, follow');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${SITE_URL}/`);
  });
});
