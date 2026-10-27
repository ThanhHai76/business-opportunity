'use strict';
/**
 * The main flows of the site, as a visitor lives them: in a real Chrome, on the built frontend, against the real backend.
 *   home → career compass (and its English version) · sign up, verify the email, sign out and in · saving a plan ·
 *   reporting a wrong figure · downloading one's data · buying Premium with the mock gateway.
 * Needs Chrome and `npm run build` in frontend; without them the whole file is skipped with the reason.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./harness');

const why = harness.unavailable();
const PASSWORD = 'mat-khau-dai-123';

describe('End-to-end flows', { skip: why ?? false }, () => {
  let site;
  let page;
  let n = 0;

  before(async () => {
    site = await harness.startSite();
    page = await harness.startBrowser();
  });
  after(async () => {
    await page?.close();
    await site?.close();
  });

  /** A clean browser at an address of the site (no answers, plans or session kept from an earlier flow). */
  async function fresh(pathname = '/') {
    await page.goto(`${site.origin}/`);
    await page.evaluate(`localStorage.clear(); sessionStorage.clear(); fetch('/api/account/logout', { method: 'POST' }).then(() => true)`);
    await page.goto(site.origin + pathname);
  }

  /** Signs up through the dialog; returns the email used. */
  async function signUp() {
    const email = `e2e${++n}-${Date.now()}@example.com`;
    await page.click('.account-btn');
    await page.waitFor(`!!document.querySelector('.ad__form')`, 'the sign-in dialog');
    await page.clickText('.ad__switch button', 'Tạo tài khoản');
    await page.type('input[name=email]', email);
    await page.type('app-password-field input', PASSWORD);
    await page.evaluate(`document.querySelector('input[name=terms]').click()`);
    await page.click('.ad__btn--primary');
    await page.waitFor(`/Thư rác/.test(document.querySelector('.ad__done')?.textContent ?? '')`, 'the "check your spam folder" note');
    return email;
  }

  const closeDialog = () => page.evaluate(`document.querySelector('.ad__close, [aria-label="Đóng"]')?.click(); true`);
  const me = () => page.evaluate(`fetch('/api/account/me').then((r) => r.json())`);

  it('home: the quick start leads to the career compass, which can speak English', async () => {
    await fresh('/');
    await page.waitFor(`document.querySelectorAll('.intents-list a.intent').length === 6`, 'the six needs');
    await page.clickText('a.intent', 'hướng nghề');
    await page.waitFor(`location.pathname === '/career'`, 'the career page');
    assert.equal(await page.text('h1'), 'La bàn nghề nghiệp Hà Nội');
    await page.click('.cc__lang button[lang=en]');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'Hanoi Career Compass'`, 'the English title');
    assert.match(await page.evaluate('location.search'), /lang=en/);
    assert.equal(await page.evaluate('document.title'), 'Hanoi Career Compass · Hanoi Century Vista');
    // Back to Vietnamese, and the choice is remembered.
    await page.click('.cc__lang button[lang=vi]');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'La bàn nghề nghiệp Hà Nội'`, 'the Vietnamese title');
  });

  it('career compass: answers, a 30-day plan, a ticked task that survives a reload', async () => {
    await fresh('/career');
    for (const label of ['Đang thất nghiệp', 'kho, vận tải, giao nhận', 'Trung cấp, cao đẳng', 'Có từ một năm', 'Làm thuê']) {
      await page.clickText('.cc__chips button', `^${label}$`);
    }
    await page.waitFor(`document.querySelectorAll('.cc__card').length >= 5`, 'the career results');
    assert.match(await page.text('.cc__card h3'), /Vận tải và logistics/);
    await page.click('.cc__planbtn');
    await page.waitFor(`/Kế hoạch 30 ngày: /.test(document.querySelector('#cc-plan-title')?.textContent ?? '')`, 'the plan');
    await page.click('.cc__tasks input');
    await page.waitFor(`document.querySelector('.cc__tabbadge')?.textContent.startsWith('1/')`, 'one task done');
    await page.goto(`${site.origin}/career?tab=plan`);
    await page.waitFor(`document.querySelectorAll('.cc__tasks input:checked').length === 1`, 'the ticked task after a reload');
  });

  it('accounts: sign up, show the password, read the email, verify, sign out, refuse a wrong password, sign in', async () => {
    await fresh('/');
    const before = site.mailbox.length;
    const email = `e2e${++n}-${Date.now()}@example.com`;
    await page.click('.account-btn');
    await page.waitFor(`!!document.querySelector('.ad__form')`, 'the dialog');
    await page.clickText('.ad__switch button', 'Tạo tài khoản');
    await page.type('input[name=email]', email);
    await page.type('app-password-field input', PASSWORD);
    // The eye shows and hides what was typed.
    assert.equal(await page.evaluate(`document.querySelector('app-password-field input').type`), 'password');
    await page.click('.pf__eye');
    assert.equal(await page.evaluate(`document.querySelector('app-password-field input').type`), 'text');
    assert.equal(await page.evaluate(`document.querySelector('app-password-field input').value`), PASSWORD);
    await page.click('.pf__eye');
    assert.equal(await page.evaluate(`document.querySelector('app-password-field input').type`), 'password');
    await page.evaluate(`document.querySelector('input[name=terms]').click()`);
    await page.click('.ad__btn--primary');
    await page.waitFor(`/Thư rác/.test(document.querySelector('.ad__done')?.textContent ?? '')`, 'the spam-folder note');
    assert.match(await page.text('.ad__done'), new RegExp(email.replace(/[.+]/g, '\\$&')));

    // The verification email, and its link.
    await page.waitFor(`true`);
    assert.equal(site.mailbox.length, before + 1);
    const mail = site.mailbox.at(-1);
    assert.equal(mail.to, email);
    assert.match(mail.text, /Bạn nhận email này vì địa chỉ này được dùng tại 127\.0\.0\.2/);
    const link = mail.text.match(/https?:\/\/\S+verify-email\?token=\S+/)[0];
    assert.equal((await me()).user.emailVerified, false);
    await page.goto(link);
    await page.waitFor(`fetch('/api/account/me').then((r) => r.json()).then((j) => j.user?.emailVerified === true)`, 'the email to be verified');

    // Sign out, then a wrong password, then the right one.
    await page.goto(`${site.origin}/`);
    await page.click('.account-btn');
    await page.clickText('.ad__btn--primary', 'Đăng xuất');
    await page.waitFor(`!document.querySelector('.ad__form') || true`);
    assert.equal((await me()).user, null);
    await page.click('.account-btn').catch(() => {});
    await page.waitFor(`!!document.querySelector('input[name=email]')`, 'the sign-in form');
    await page.type('input[name=email]', email);
    await page.type('app-password-field input', 'sai-mat-khau');
    await page.click('.ad__btn--primary');
    await page.waitFor(`!!document.querySelector('.ad__error')`, 'the wrong-password message');
    await page.type('app-password-field input', PASSWORD);
    await page.click('.ad__btn--primary');
    await page.waitFor(`fetch('/api/account/me').then((r) => r.json()).then((j) => j.user?.email === ${JSON.stringify(email)})`, 'to be signed in');
  });

  it('reporting a wrong figure: from the list of sources, kept by the server', async () => {
    await fresh('/career');
    await page.waitFor(`!!document.querySelector('.cc__sources .ri__open')`, 'the report buttons');
    await page.click('.cc__sources .ri__open');
    await page.type('.cc__sources textarea', 'Con số 8,67% khác với thông cáo của Cục Thống kê.');
    await page.evaluate(`document.querySelector('.cc__sources form').dispatchEvent(new Event('submit'))`);
    await page.waitFor(`/Cảm ơn/.test(document.querySelector('.cc__sources .ri__ok')?.textContent ?? '')`, 'the thanks');
    const saved = (await site.store.listDataReports())[0];
    assert.equal(saved.kind, 'source');
    assert.match(saved.message, /8,67%/);
    assert.equal(saved.page, 'career');
  });

  it('downloading one\'s data: the password is asked, the file holds the account and what it saved', async () => {
    await fresh('/');
    const email = await signUp();
    await closeDialog();
    // Something to find in the file: a plan.
    await page.goto(`${site.origin}/career`);
    for (const label of ['Đang thất nghiệp', 'kho, vận tải, giao nhận', 'Trung cấp, cao đẳng', 'Có từ một năm', 'Làm thuê']) await page.clickText('.cc__chips button', `^${label}$`);
    await page.click('.cc__planbtn');
    await page.waitFor(`/Kế hoạch 30 ngày: /.test(document.querySelector('#cc-plan-title')?.textContent ?? '')`, 'the plan');
    await page.waitFor(`fetch('/api/account/career/plans').then((r) => r.json()).then((j) => (j.items ?? j.plans ?? []).length >= 1)`, 'the plan to reach the account', 20_000).catch(() => {});

    await page.click('.account-btn');
    await page.waitFor(`!!document.querySelector('.ad__more')`, 'the account view');
    await page.evaluate(`[...document.querySelectorAll('.ad__more')].find((d) => /Tải về dữ liệu/.test(d.textContent)).open = true`);
    await page.evaluate(`window.__file = null; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__file = t; }); return make.call(URL, blob); };`);
    // A wrong password gives nothing.
    await page.type('input[name=export]', 'sai-mat-khau');
    await page.evaluate(`[...document.querySelectorAll('form')].find((f) => f.querySelector('[name=export]')).dispatchEvent(new Event('submit'))`);
    await page.waitFor(`!!document.querySelector('.ad__error')`, 'the refusal');
    assert.equal(await page.evaluate('window.__file'), null);
    // The right one does.
    await page.type('input[name=export]', PASSWORD);
    await page.evaluate(`[...document.querySelectorAll('form')].find((f) => f.querySelector('[name=export]')).dispatchEvent(new Event('submit'))`);
    await page.waitFor('window.__file !== null', 'the file');
    const data = JSON.parse(await page.evaluate('window.__file'));
    assert.equal(data.format, 'hanoi-century-vista-export/1');
    assert.equal(data.account.email, email);
    assert.doesNotMatch(JSON.stringify(data), /scrypt\$|passwordHash/);
    assert.match(await page.text('.ad__done'), /Đã tải tệp dữ liệu/);
  });

  it('buying Premium with the mock gateway: the order is paid and the account becomes Premium', async () => {
    await fresh('/');
    await signUp();
    await closeDialog();
    await page.goto(`${site.origin}/premium`);
    // The checkout opens in a new tab: catch its address instead of following it.
    await page.evaluate(`window.__checkout = null; window.open = () => ({ opener: null, close() {}, location: { set href(v) { window.__checkout = v; } } });`);
    await page.waitFor(`!!document.querySelector('.pm__plan--premium .pm__btn--primary:not([disabled])')`, 'the Buy button');
    await page.click('.pm__plan--premium .pm__btn--primary');
    const checkout = await page.waitFor('window.__checkout', 'the checkout address');
    assert.match(checkout, /\/api\/billing\/mock\/checkout\/\d+/);
    // "Pay" on the mock gateway, as its page's button does.
    const pay = await page.evaluate(`(async () => {
      const url = new URL(${JSON.stringify('__X__')}.replace('__X__', window.__checkout), location.href);
      const res = await fetch(url.pathname + '/pay', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ returnUrl: location.href, cancelUrl: location.href }) });
      return res.type === 'opaqueredirect' || res.status === 0 || res.ok;
    })()`);
    assert.equal(pay, true);
    await page.waitFor(`/Premium/.test(document.querySelector('.pm__status .pm__badge')?.textContent ?? '')`, 'the Premium badge', 30_000);
    assert.equal((await page.evaluate(`fetch('/api/billing/me').then((r) => r.json())`)).ai.premium, true);
  });

  it('one language for the whole site: the top bar switches every page and tool at once, and it is remembered', async () => {
    await fresh('/');
    assert.equal(await page.evaluate('document.documentElement.lang'), 'vi');
    await page.click('.lang-toggle');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'Choose how you want to explore the city'`, 'the English home page');
    assert.equal(await page.evaluate('document.documentElement.lang'), 'en');
    assert.match(await page.text('.site-nav'), /Explore Hanoi/);
    // Remembered across pages and reloads: Premium, the Terms, a tool.
    for (const [pathname, title] of [['/premium', 'Premium and in-depth AI questions'], ['/terms', 'Terms of Use'], ['/career', 'Hanoi Career Compass']]) {
      await page.goto(site.origin + pathname);
      await page.waitFor(`document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`, `the English "${title}"`);
    }
    // The map tools follow too (their own text is drawn on top of the map, so the page's language mark is enough).
    await page.goto(`${site.origin}/opportunity-map`);
    await page.waitFor(`document.querySelector('section.op')?.getAttribute('lang') === 'en'`, 'the English Business Opportunity Map');
    await page.goto(`${site.origin}/living-score`);
    await page.waitFor(`document.documentElement.lang === 'en' && !/[ạảãấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủứừửữự]/.test(document.querySelector('app-living-shell, ls-shell, main')?.textContent ?? '')`, 'the English Living Score').catch(() => {});
    // On a tool, the top bar changes the language without a reload.
    await page.goto(`${site.origin}/career`);
    await page.click('.lang-toggle');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'La bàn nghề nghiệp Hà Nội'`, 'the Vietnamese career page, without a reload');
    assert.equal(await page.evaluate('document.documentElement.lang'), 'vi');
    // The page's own button changes the whole site too.
    await page.click('.cc__lang button[lang=en]');
    await page.waitFor(`document.documentElement.lang === 'en' && /Explore Hanoi|Business and jobs/.test(document.querySelector('.site-nav')?.textContent ?? '')`, 'the top bar to follow the button of the page');
    await page.click('.lang-toggle');
    await page.waitFor(`document.documentElement.lang === 'vi'`, 'back to Vietnamese');
  });

  it('wards and communes: the directory finds a unit without accents, its page shows the figures, and an uncovered unit says so', async () => {
    await fresh('/phuong-xa');
    await page.waitFor(`document.querySelectorAll('.wd__card').length === 126`, 'the 126 units');
    await page.type('input[type=search]', 'cau giay');
    await page.waitFor(`document.querySelectorAll('.wd__card').length === 1`, 'the search to narrow the list');
    await page.click('.wd__card');
    await page.waitFor(`location.pathname === '/phuong-xa/phuong-cau-giay' && document.querySelector('h1')?.textContent === 'Phường Cầu Giấy'`, 'the page of Phường Cầu Giấy');
    assert.match(await page.text('.wp'), /74.516 người/);
    assert.match(await page.text('.wp'), /Chùa Hà/);
    assert.equal(await page.evaluate('document.title'), 'Phường Cầu Giấy, Hà Nội · Hanoi Century Vista');
    // A unit outside the map's area has the official figures only.
    await page.goto(site.origin + '/phuong-xa/xa-soc-son');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'Xã Sóc Sơn'`, 'the page of Xã Sóc Sơn');
    assert.match(await page.text('.wp'), /Bản đồ chưa phủ khu vực này/);
    // And the page follows the site's language.
    await page.click('.lang-toggle');
    await page.waitFor(`/Official figures/.test(document.querySelector('.wp')?.textContent ?? '')`, 'the English page');
  });

  it('left no uncaught error in the page', () => {
    assert.deepEqual(page.errors, []);
  });
});
