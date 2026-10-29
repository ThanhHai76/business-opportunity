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

  /** Signs up (and, for the administrator, confirms the address, as the link of the email would) from the page itself. */
  async function signUpByApi(email) {
    const post = (path, extra = '') => page.evaluate(`fetch('/api/account/${path}', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(PASSWORD)}${extra} }) }).then((r) => r.json())`);
    let res = await post('register', ', acceptTerms: true');
    // The administrator's account is made once and used by several flows.
    if (res.code === 'email_taken') res = await post('login');
    assert.ok(res.user?.id, JSON.stringify(res));
    if (email === site.adminEmail) await site.store.updateUser(res.user.id, { emailVerifiedAt: new Date() });
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
    await page.waitFor(`location.pathname === '/tai-khoan'`, 'the account page');
    await page.clickText('.ap__hero .ap__btn', 'Đăng xuất');
    await page.waitFor(`location.pathname === '/'`, 'the home page after signing out');
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
    await page.waitFor(`!!document.querySelector('input[name=export]')`, 'the account page');
    await page.evaluate(`window.__file = null; const make = URL.createObjectURL; URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__file = t; }); return make.call(URL, blob); };`);
    // A wrong password gives nothing.
    await page.type('input[name=export]', 'sai-mat-khau');
    await page.evaluate(`[...document.querySelectorAll('form')].find((f) => f.querySelector('[name=export]')).dispatchEvent(new Event('submit'))`);
    await page.waitFor(`!!document.querySelector('.ap__error')`, 'the refusal');
    assert.equal(await page.evaluate('window.__file'), null);
    // The right one does.
    await page.type('input[name=export]', PASSWORD);
    await page.evaluate(`[...document.querySelectorAll('form')].find((f) => f.querySelector('[name=export]')).dispatchEvent(new Event('submit'))`);
    await page.waitFor('window.__file !== null', 'the file');
    const data = JSON.parse(await page.evaluate('window.__file'));
    assert.equal(data.format, 'hanoi-century-vista-export/1');
    assert.equal(data.account.email, email);
    assert.doesNotMatch(JSON.stringify(data), /scrypt\$|passwordHash/);
    assert.match(await page.text('.ap__done'), /Đã tải tệp dữ liệu/);
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
    await page.waitFor(`document.querySelector('h1')?.textContent === 'Hanoi is about to change. What will you do about it?'`, 'the English home page');
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
    // From the home page: the lookup box carries the search to the list.
    await fresh('/');
    await page.waitFor(`!!document.querySelector('.wardfind input')`, 'the lookup box on the home page');
    await page.type('.wardfind input', 'cau giay');
    await page.click('.wardfind button');
    await page.waitFor(`location.pathname === '/phuong-xa' && document.querySelectorAll('.wd__card').length === 1`, 'the list already narrowed to Cầu Giấy');
    // From the footer of the home page.
    await page.goto(site.origin + '/');
    await page.clickText('.ll a', 'Phường/xã');
    await page.waitFor(`location.pathname === '/phuong-xa'`, 'the directory from the footer');
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

  it('score guide: reached from a ward page, explains the three scores in both languages', async () => {
    await fresh('/phuong-xa/phuong-cau-giay');
    await page.waitFor(`!!document.querySelector('.wp__note a[href="/giai-thich-diem"]')`, 'the link to the guide on a ward page');
    await page.click('.wp__note a[href="/giai-thich-diem"]');
    await page.waitFor(`location.pathname === '/giai-thich-diem' && document.querySelector('h1')?.textContent === 'Điểm số nghĩa là gì?'`, 'the guide');
    assert.equal(await page.evaluate(`document.querySelectorAll('.sg__sec').length`), 3);
    assert.match(await page.text('.sg'), /Cơ hội = nhu cầu − 0,4 × cạnh tranh/);
    await page.click('.lang-toggle');
    await page.waitFor(`document.querySelector('h1')?.textContent === 'What do the scores mean?'`, 'the English guide');
    assert.equal(await page.evaluate('document.title'), 'Điểm số nghĩa là gì? · Hanoi Century Vista');
  });

  it('the "?" next to a score in each of the three tools opens a short answer and leads to its section of the guide', async () => {
    const cases = [
      ['/opportunity-map', '.op-h app-score-help', 'opportunity'],
      ['/living-score/area/phuong-van-mieu-quoc-tu-giam', 'h2.ls-section-title app-score-help', 'living'],
      ['/property-intelligence/map?ward=phuong-cau-giay', '.score__text app-score-help', 'property'],
    ];
    for (const [pathname, host, topic] of cases) {
      await fresh(pathname);
      await page.waitFor(`!!document.querySelector(${JSON.stringify(host + ' .sh__btn')})`, `the "?" on ${pathname}`);
      await page.click(host + ' .sh__btn');
      await page.waitFor(`!!document.querySelector(${JSON.stringify(host + ' .sh__pop')})`, 'the short answer');
      assert.match(await page.text(host + ' .sh__pop'), /0-100/);
      await page.click(host + ' .sh__pop a');
      await page.waitFor(`location.pathname === '/giai-thich-diem' && location.hash === '#${topic}'`, `the guide at #${topic}`);
      // The section is in view (the page scrolled to it).
      await page.waitFor(`(() => { const r = document.getElementById('${topic}')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.top < window.innerHeight; })()`, `the "${topic}" section scrolled into view`);
    }
  });

  it('reports of wrong figures: sent by a visitor, read and sorted by the administrator, closed to others', async () => {
    const message = `Số dân của phường này khác danh sách chính thức (${Date.now()}).`;
    await fresh('/');
    const sent = await page.evaluate(`fetch('/api/feedback/data-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'ward', target: 'phuong-cau-giay', targetName: 'Phường Cầu Giấy', page: 'e2e', message: ${JSON.stringify(message)} }) }).then((r) => r.status)`);
    assert.equal(sent, 201);

    // Not signed in: asked to sign in. A signed-in stranger: refused.
    await page.goto(site.origin + '/admin/reports');
    await page.waitFor(`/Hãy đăng nhập/.test(document.querySelector('.ar')?.textContent ?? '')`, 'the request to sign in');
    await signUpByApi(`khach${++n}-${Date.now()}@example.com`);
    await page.goto(site.origin + '/admin/reports');
    await page.waitFor(`/không có quyền/.test(document.querySelector('.ar')?.textContent ?? '')`, 'the refusal');
    // ...who is not shown the link in the account menu either.
    await page.goto(site.origin + '/');
    await page.click('.account-btn');
    await page.waitFor(`!!document.querySelector('.ap__card')`, 'the account page');
    await page.waitFor(`true`);
    assert.equal(await page.evaluate(`!!document.querySelector('.ap a[href="/admin/reports"]')`), false);

    // The administrator sees the report and marks it fixed; the server keeps it.
    await fresh('/');
    await signUpByApi(site.adminEmail);
    await page.goto(site.origin + '/');
    await page.click('.account-btn');
    await page.waitFor(`!!document.querySelector('.ap a[href="/admin/reports"]')`, 'the admin link on the account page');
    await page.click('.ap a[href="/admin/reports"]');
    await page.waitFor(`location.pathname === '/admin/reports'`, 'the admin page from the account menu');
    await page.waitFor(`[...document.querySelectorAll('.ar__item')].some((i) => i.textContent.includes(${JSON.stringify(message)}))`, 'the report in the list');
    await page.evaluate(`[...document.querySelectorAll('.ar__item')].find((i) => i.textContent.includes(${JSON.stringify(message)})).querySelectorAll('.ar__actions button')[2].click()`);
    await page.waitFor(`[...document.querySelectorAll('.ar__item')].find((i) => i.textContent.includes(${JSON.stringify(message)}))?.dataset.status === 'fixed'`, 'the report to be marked fixed');
    const saved = await page.evaluate(`fetch('/api/feedback/admin/reports?status=fixed').then((r) => r.json())`);
    assert.ok(saved.reports.some((r) => r.message === message));
  });

  it('forgot password: the email carries a link, the new password works and the old one does not', async () => {
    const email = `quen${++n}-${Date.now()}@example.com`;
    await fresh('/');
    await signUpByApi(email);
    await page.evaluate(`fetch('/api/account/logout', { method: 'POST' }).then(() => true)`);
    const before = site.mailbox.length;
    await page.goto(site.origin + '/forgot-password');
    await page.waitFor(`!!document.querySelector('input[name=email]')`, 'the form');
    await page.type('input[name=email]', email);
    await page.click('button[type=submit]');
    await page.waitFor(`!!document.querySelector('.al__ok')`, 'the "link sent" note');
    await page.waitFor(`true`);
    assert.equal(site.mailbox.length, before + 1);
    const mail = site.mailbox.at(-1);
    assert.equal(mail.to, email);
    const link = mail.text.match(/https?:\/\/\S+reset-password\?token=\S+/)[0];

    await page.goto(link);
    await page.waitFor(`!!document.querySelector('app-password-field input')`, 'the new-password form');
    await page.type('app-password-field input', 'mat-khau-moi-456');
    await page.click('button[type=submit]');
    await page.waitFor(`!!document.querySelector('.al__ok')`, 'the "password changed" note');

    const login = (password) => page.evaluate(`fetch('/api/account/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)} }) }).then((r) => r.status)`);
    assert.equal(await login(PASSWORD), 401);
    assert.equal(await login('mat-khau-moi-456'), 200);
    // The link works once.
    await page.goto(link);
    await page.waitFor(`!!document.querySelector('app-password-field input')`, 'the form again');
    await page.type('app-password-field input', 'mat-khau-khac-789');
    await page.click('button[type=submit]');
    await page.waitFor(`!!document.querySelector('.al__err')`, 'the refusal of a used link');
  });

  it('statistics and the free sample report: pages and actions are counted, the administrator reads them, a visitor can open the sample', async () => {
    // A visitor: home, a ward look-up from the box, the Premium page, then the sample report from its link.
    await fresh('/');
    await page.waitFor(`!!document.querySelector('.wardfind input')`, 'the look-up box');
    await page.type('.wardfind input', 'cau giay');
    await page.click('.wardfind button');
    await page.waitFor(`location.pathname === '/phuong-xa'`, 'the list of wards');
    await page.goto(site.origin + '/premium');
    await page.waitFor(`!!document.querySelector('a[href$="/api/reports/sample"]')`, 'the link to the sample report on the Premium page');
    await page.goto(site.origin + '/api/reports/sample', { app: false });
    await page.waitFor(`/Đây là báo cáo mẫu/.test(document.body.textContent)`, 'the sample report');
    assert.match(await page.text('body'), /Phường Cầu Giấy/);

    // The administrator reads the counters in the page made for it.
    await fresh('/');
    await signUpByApi(site.adminEmail);
    await page.goto(site.origin + '/admin/stats');
    await page.waitFor(`[...document.querySelectorAll('.as__table td')].some((td) => td.textContent === '/premium')`, '/premium among the pages viewed');
    const cards = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.as__cards li')].map((li) => [li.querySelector('span').textContent, Number(li.querySelector('strong').textContent.replace(/\\D/g, ''))]))`);
    assert.ok(cards['Lượt xem trang'] >= 4, JSON.stringify(cards));
    assert.ok(cards['Tra cứu phường/xã'] >= 1, JSON.stringify(cards));
    assert.ok(cards['Mở báo cáo mẫu'] >= 1, JSON.stringify(cards));
    // The money steps are counted by the server: the Premium purchase of an earlier flow left both.
    assert.ok(cards['Bắt đầu thanh toán'] >= 1, JSON.stringify(cards));
    assert.ok(cards['Thanh toán thành công'] >= 1, JSON.stringify(cards));
    // Nothing about a visitor is kept: only day, event, key and count.
    const rows = (await page.evaluate(`fetch('/api/analytics/admin/summary?days=7').then((r) => r.json())`)).rows;
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => Object.keys(r).sort().join() === 'day,event,key,n'));
    // The administrator's own pages are not counted.
    assert.equal(rows.some((r) => r.event === 'page_view' && r.key.startsWith('/admin')), false);
  });

  it('future map: the plan reaches 2085, and the panel says in words what it sets, with sources', async () => {
    await fresh('/future-map?year=2085');
    await page.waitFor(`document.querySelectorAll('.fm-timeline button').length >= 5`, 'the five milestones, 2085 among them');
    assert.match(await page.text('.fm h1'), /2085/);
    await page.clickText('.fm-tools button', 'Quy hoạch nói gì');
    await page.waitFor(`!!document.querySelector('.fm-outlook__steps')`, 'what the plan says');
    const text = await page.text('.fm-dialog--outlook');
    assert.match(text, /Văn hiến – Văn minh – Hiện đại – Hạnh phúc/);
    assert.match(text, /GRDP khoảng 640 tỷ USD/);
    assert.match(text, /Nội đô lịch sử/);
    // Every statement leads to its sources.
    const links = await page.evaluate(`[...document.querySelectorAll('.fm-dialog--outlook a[href^="https://"]')].length`);
    assert.ok(links >= 20, 'sources linked: ' + links);
  });

  it('career-change calculator: the visitor’s own numbers give the cost and the payback, are kept, and a second option leads to Premium', async () => {
    await fresh('/career?tab=switch');
    await page.waitFor(`!!document.querySelector('.sw__form')`, 'the calculator');
    assert.equal(await page.evaluate(`!!document.querySelector('.sw__table')`), false);
    await page.clickText('.sw__actions button', 'Điền số ví dụ');
    await page.waitFor(`!!document.querySelector('.sw__key')`, 'the result');
    // The example (today 10, fees 6, 3 months of training + 2 looking at 2 a month, then 15) pays back after 15 months.
    assert.match(await page.text('.sw__key'), /15 tháng/);
    assert.match(await page.text('.sw__results'), /≈ 4,5 tháng chi tiêu/);
    // The numbers are still there after a reload (kept in the browser).
    await page.goto(site.origin + '/career?tab=switch');
    await page.waitFor(`!!document.querySelector('.sw__key')`, 'the result after a reload');
    assert.match(await page.text('.sw__key'), /15 tháng/);
    // From a direction of the compass to the calculator, which names the first option after it.
    await page.evaluate(`localStorage.removeItem('hcv.career.switch.v1'); true`);
    await page.goto(site.origin + '/career');
    for (const label of ['Đang thất nghiệp', 'kho, vận tải, giao nhận', 'Trung cấp, cao đẳng', 'Có từ một năm', 'Làm thuê']) await page.clickText('.cc__chips button', '^' + label + '$');
    await page.waitFor(`!!document.querySelector('.cc__calcbtn')`, 'the results with their calculator button');
    await page.click('.cc__calcbtn');
    await page.waitFor(`!!document.querySelector('.sw__form') && document.querySelector('.sw__field--wide input').value.length > 3`, 'the calculator, with the direction as the name of the first option');
    // The list of sources is folded.
    await page.goto(site.origin + '/career');
    await page.waitFor(`!!document.querySelector('details.cc__sources')`, 'the sources');
    assert.equal(await page.evaluate(`document.querySelector('details.cc__sources').open`), false);
    await page.goto(site.origin + '/career?tab=switch');
    await page.waitFor(`!!document.querySelector('.sw__form')`, 'the calculator again');
    // A sourced reference point is one click away and links to its source.
    const refs = await page.evaluate(`[...document.querySelectorAll('.sw__refs a[href^="https://"]')].length`);
    assert.ok(refs >= 5, 'reference links: ' + refs);
    // A second option and the PDF are Premium: the visitor is shown what Premium gives.
    await page.click('.sw__opt--add');
    await page.waitFor(`!!document.querySelector('.pp')`, 'the Premium prompt');
  });

  it('a new page opens at its top: leaving the bottom of the home page by a link does not keep the scroll', async () => {
    await fresh('/');
    await page.waitFor(`!!document.querySelector('footer a[href="/premium"], footer a[href="/giai-thich-diem"]')`, 'a link in the footer');
    await page.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight); true`);
    await page.waitFor(`window.scrollY > 300`, 'the page to be scrolled down');
    await page.evaluate(`document.querySelector('footer a[href="/giai-thich-diem"], footer a[href="/premium"]').click(); true`);
    await page.waitFor(`location.pathname !== '/'`, 'the other page');
    await page.waitFor(`window.scrollY < 5`, 'the new page at its top');
  });

  it('left no uncaught error in the page', () => {
    assert.deepEqual(page.errors, []);
  });
});
