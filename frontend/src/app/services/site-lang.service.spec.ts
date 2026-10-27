import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { accountError } from './account.service';
import { SITE_LANG_KEY, SiteLangService, initialSiteLang, resetSiteLangForTests, siteLangNow } from './site-lang.service';

describe('SiteLangService (one language for the whole site)', () => {
  it('starts in Vietnamese, and takes a language a tool saved before the site had one', () => {
    expect(initialSiteLang()).toBe('vi');
    localStorage.setItem('hanoi100.fm.lang', 'en');
    expect(initialSiteLang()).toBe('en');
    // The site's own choice wins over a tool's old one.
    localStorage.setItem(SITE_LANG_KEY, 'vi');
    expect(initialSiteLang()).toBe('vi');
  });

  it('writes the choice for the site and for every tool, so each one opens in it', () => {
    const site = TestBed.inject(SiteLangService);
    site.set('en');
    expect(site.lang()).toBe('en');
    expect(siteLangNow()).toBe('en');
    for (const key of [SITE_LANG_KEY, 'hanoi100.op.lang', 'hanoi100.fm.lang', 'hanoi100.tm.lang', 'hanoi100.ls.lang']) expect(localStorage.getItem(key)).withContext(key).toBe('en');
    site.toggle();
    expect(site.lang()).toBe('vi');
    expect(localStorage.getItem('hanoi100.ls.lang')).toBe('vi');
  });

  it('tells the browser which language the page is in', () => {
    const site = TestBed.inject(SiteLangService);
    TestBed.flushEffects();
    expect(document.documentElement.lang).toBe('vi');
    site.set('en');
    TestBed.flushEffects();
    expect(document.documentElement.lang).toBe('en');
  });

  it('forgets everything for the next test', () => {
    TestBed.inject(SiteLangService).set('en');
    resetSiteLangForTests();
    expect(initialSiteLang()).toBe('vi');
    expect(siteLangNow()).toBe('vi');
  });

  it('words an error from the server in English by its code, and in Vietnamese by its message', () => {
    const wrong = new HttpErrorResponse({ status: 403, error: { code: 'bad_credentials', message: 'Mật khẩu không đúng.' } });
    expect(accountError(wrong)).toBe('Mật khẩu không đúng.');
    TestBed.inject(SiteLangService).set('en');
    expect(accountError(wrong)).toBe('The email or password is not correct.');
    expect(accountError(new HttpErrorResponse({ status: 0 }))).toBe('Cannot reach the server. Check your connection and try again.');
    expect(accountError(new HttpErrorResponse({ status: 500, error: { code: 'something_new', message: 'Lỗi' } }))).toBe('Something went wrong. Please try again.');
  });
});
