import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ANALYTICS_API_URL } from '../config';
import { setAnalyticsForTests, startAnalytics, track } from './analytics';

describe('the site\'s own visit counters', () => {
  let fetchSpy: jasmine.Spy;
  const sent = () => fetchSpy.calls.allArgs().map(([url, init]) => ({ url: url as string, body: JSON.parse((init as RequestInit).body as string), init: init as RequestInit }));

  beforeEach(() => {
    setAnalyticsForTests(true);
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 204 }));
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
  });
  afterEach(() => setAnalyticsForTests(false));

  it('sends an event as a bare counter: no cookie, nothing about the visitor', () => {
    track('ward_lookup');
    track('score_help', 'living');
    expect(sent().map((c) => c.body)).toEqual([{ event: 'ward_lookup' }, { event: 'score_help', key: 'living' }]);
    expect(sent()[0].url).toBe(`${ANALYTICS_API_URL}/event`);
    expect(sent()[0].init.credentials).toBe('omit');
  });

  it('sends one page view per page, without the query string, and none for the administrator\'s pages', async () => {
    TestBed.runInInjectionContext(() => startAnalytics());
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/phuong-xa/phuong-cau-giay?q=1');
    await router.navigateByUrl('/admin/reports');
    await router.navigateByUrl('/career');
    expect(sent().map((c) => c.body)).toEqual([
      { event: 'page_view', key: '/phuong-xa/phuong-cau-giay' },
      { event: 'page_view', key: '/career' },
    ]);
  });

  it('sends nothing when the browser asks not to be tracked', () => {
    spyOnProperty(navigator, 'doNotTrack', 'get').and.returnValue('1');
    track('signup');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never fails the page when the server is not reachable', async () => {
    fetchSpy.and.rejectWith(new TypeError('network'));
    expect(() => track('signup')).not.toThrow();
    await Promise.resolve();
  });

  it('is off in the other tests', () => {
    setAnalyticsForTests(false);
    track('signup');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
