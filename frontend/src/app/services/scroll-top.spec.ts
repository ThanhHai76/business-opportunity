import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { pathOf, shouldScrollTop, startScrollToTop } from './scroll-top';

@Component({ standalone: true, template: '' })
class Blank {}

describe('scrolling to the top of a new page', () => {
  it('reads the path of an address', () => {
    expect(pathOf('/phuong-xa/cau-giay?lang=en#x')).toBe('/phuong-xa/cau-giay');
    expect(pathOf('/')).toBe('/');
    expect(pathOf('/?tab=map')).toBe('/');
  });

  it('scrolls for another page, and only then', () => {
    expect(shouldScrollTop('/', '/premium', 'imperative')).toBeTrue();
    expect(shouldScrollTop('/living-score/explore', '/living-score/compare', 'imperative')).toBeTrue();
    expect(shouldScrollTop('/premium', '/premium?year=2035', 'imperative')).toBeFalse(); // a filter of the same page
    expect(shouldScrollTop('/giai-thich-diem', '/giai-thich-diem#opportunity', 'imperative')).toBeFalse();
    expect(shouldScrollTop('/', '/premium#plans', 'imperative')).toBeFalse(); // the page goes to the fragment itself
    expect(shouldScrollTop('/', '/premium', 'popstate')).toBeFalse(); // back and forward keep the place
    expect(shouldScrollTop(null, '/premium', 'imperative')).toBeFalse(); // the first page
  });

  it('does it when the router arrives at another page, and not when only the query changes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'a', component: Blank },
          { path: 'b', component: Blank },
        ]),
      ],
    });
    const scroll = spyOn(window, 'scrollTo');
    TestBed.runInInjectionContext(() => startScrollToTop());
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/a');
    expect(scroll).not.toHaveBeenCalled(); // the first page
    await router.navigateByUrl('/b');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(scroll.calls.mostRecent().args[0])).toBe(JSON.stringify({ top: 0, left: 0, behavior: 'auto' }));
    await router.navigateByUrl('/b?x=1');
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
