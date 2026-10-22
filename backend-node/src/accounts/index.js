'use strict';
/**
 * Accounts and saved reports — mounted by server.js at /api/account.
 *
 *   GET    /me                      { enabled, user | null }   (never 401: the page asks this on every load)
 *   POST   /register                { email, password, displayName? }  → 201 { user } + session cookie
 *   POST   /login                   { email, password }                → { user } + session cookie
 *   POST   /logout                                                     → 204, cookie cleared
 *   PATCH  /me                      { displayName }                    → { user }
 *   POST   /me/password             { currentPassword, newPassword }   → 204, other sessions signed out
 *   POST   /forgot-password         { email }                          → 202 (the same whether or not the address has an account)
 *   POST   /reset-password          { token, password }                → 204, every session signed out (the link came by email)
 *   POST   /verify-email            { token }                          → { verified: true }
 *   POST   /verify-email/send                                          → 202, sends the link again (signed in)
 *   DELETE /me                      { password }                       → 204, account and everything saved deleted
 *   GET    /reports                                                    → { items: SavedReport[] }
 *   PUT    /reports                 SavedReport (same type + ward + horizon replaces the older one) → { item }
 *   POST   /reports/import          { items: SavedReport[] }  (the reports kept in the browser before signing in)
 *   DELETE /reports/:id · /reports  one report · all reports
 *
 * Store: PostgreSQL when DATABASE_URL is set (ACCOUNTS=auto, the default), in memory with ACCOUNTS=memory (development
 * only — lost on restart), off otherwise (every route but /me answers 503 and the page hides the account menu).
 *
 * Sessions: a random 32-byte token in an HttpOnly, SameSite=Lax cookie (Secure in production); the database keeps
 * only its SHA-256, so a leaked table cannot be replayed. State-changing requests must come from an allowed origin
 * (CSRF). Passwords: scrypt. Login and sign-up are rate limited.
 *
 * Email (src/mailer): a link to verify the address is sent at sign-up, and a link to reset a forgotten password on
 * request. Both are random one-time tokens (only their SHA-256 is stored) that expire: 48 h to verify, 1 h to reset.
 * Without a mailer (MAIL_PROVIDER=off, or no APP_URL in production) these routes answer 503 and `/me` says `mail: false`,
 * so the page hides them. With real mail (SMTP) a verified address is needed to buy (REQUIRE_VERIFIED_EMAIL).
 */
const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { AccountError, badRequest, unauthorized, forbidden, notFound, disabled, paymentRequired } = require('./errors');
const { OPEN_GATE } = require('../billing/premium-gate');
const { hashPassword, verifyPassword, dummyHash } = require('./passwords');
const { verifyEmailMail, resetPasswordMail } = require('./mails');
const { MemoryStore } = require('./memory-store');

const COOKIE = 'h100_sid';
const SESSION_DAYS = 30;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
/** Saved reports kept per account (Premium, and when nothing is for sale), and without Premium while it is for sale. */
const MAX_REPORTS = 100;
const FREE_REPORTS = 5;
const REPORT_KIND = 'opportunity_report';
const PLAN_KIND = 'career_plan';
const PROFILE_KIND = 'career_profile';
/** 30-day career plans kept in a Premium account, one per direction. */
const MAX_CAREER_PLANS = 5;
const VERIFY_HOURS = 48;
const RESET_MINUTES = 60;
/** A mailbox gets at most one link of a kind per minute, however often it is asked for. */
const RESEND_GAP_MS = 60_000;

// ---------------------------------------------------------------- validation
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Email không hợp lệ.' }));
const Password = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(200, 'Mật khẩu quá dài.');
const DisplayName = z.string().trim().max(80).transform((s) => s || null);
const RegisterSchema = z.strictObject({ email: Email, password: Password, displayName: DisplayName.optional(), acceptTerms: z.literal(true).optional() });
const LoginSchema = z.strictObject({ email: Email, password: z.string().min(1).max(200) });
const ProfileSchema = z.strictObject({ displayName: DisplayName });
const PasswordSchema = z.strictObject({ currentPassword: z.string().min(1).max(200), newPassword: Password });
const DeleteSchema = z.strictObject({ password: z.string().min(1).max(200) });
const ForgotSchema = z.strictObject({ email: Email });
const Token = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/, 'Liên kết không hợp lệ hoặc đã hết hạn.');
const TokenSchema = z.strictObject({ token: Token });
const ResetSchema = z.strictObject({ token: Token, password: Password });

const Slug = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Num = z.number().finite();
/** A report as the Opportunity Map saves it (frontend/src/app/opportunity/op-reports.ts). */
const ReportSchema = z.strictObject({
  id: z.string().max(64).optional(),
  savedAt: z.iso.datetime({ offset: true }).optional(),
  type: Slug,
  typeName: z.string().max(80),
  icon: z.string().max(16),
  ward: Slug,
  wardName: z.string().max(80),
  horizon: z.enum(['now', '2030']),
  score: Num.min(0).max(100),
  demand: Num.min(0).max(100),
  competition: Num.min(0).max(100),
  count: z.number().int().min(0).max(100_000),
  assumptions: z.record(z.string().max(40), z.union([Num, z.string().max(20)])).refine((a) => Object.keys(a).length <= 40),
  result: z.strictObject({
    revenue: Num,
    costs: Num,
    profit: Num,
    marginPct: Num,
    investment: Num,
    paybackMonths: z.number().int().min(0).max(1000).nullable(),
    budgetGap: Num,
  }),
  risk: z.enum(['low', 'medium', 'high']),
});
const ImportSchema = z.strictObject({ items: z.array(ReportSchema).max(MAX_REPORTS * 2) });
/**
 * The career compass (frontend/src/app/career): the visitor's answers, and a 30-day plan per direction with the steps
 * ticked off. Kept in the account for Premium; everyone else keeps them in the browser.
 */
const DirectionId = z.string().regex(/^[a-z0-9-]{1,40}$/);
const CareerPlanSchema = z.strictObject({
  startedAt: z.iso.datetime({ offset: true }),
  done: z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(40),
});
const CareerProfileSchema = z.strictObject({
  situation: z.enum(['unemployed', 'switching', 'graduate', 'employed']).nullable(),
  backgrounds: z.array(z.enum(['tech', 'engineering', 'sales', 'logistics', 'service', 'finance', 'other'])).max(7),
  education: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
  time: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
  work: z.enum(['employee', 'self', 'either']).nullable(),
  ward: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).nullable(),
});
const toPlan = (item) => ({ directionId: item.key, ...item.payload, updatedAt: new Date(item.updatedAt).toISOString() });

/** A Premium note and tags on a saved report. */
const NoteSchema = z.strictObject({
  note: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(3).optional(),
});

function parse(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.');
  return result.data;
}

const reportKey = (r) => `${r.type}|${r.ward}|${r.horizon}`;
/** A stored report as the page expects it: the server id, and the save time from the database. */
const toReport = (item) => ({ ...item.payload, id: item.id, savedAt: new Date(item.updatedAt).toISOString() });

// ---------------------------------------------------------------- cookies & tokens
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function createStore(config) {
  const mode = config.mode ?? 'auto';
  if (mode === 'memory') return new MemoryStore();
  if ((mode === 'auto' || mode === 'postgres') && config.databaseUrl) {
    const { Pool } = require('pg');
    const { PostgresStore } = require('./postgres-store');
    return new PostgresStore(new Pool({ connectionString: config.databaseUrl, max: 5 }));
  }
  if (mode === 'postgres') throw new Error('ACCOUNTS=postgres needs DATABASE_URL');
  return null;
}

/**
 * @param options {
 *   store?: a store (tests), or built from config;
 *   config?: { mode: 'auto'|'postgres'|'memory'|'off', databaseUrl, secureCookie };
 *   isAllowedOrigin?: (origin) => boolean   (the CORS rule of server.js);
 *   rateLimits?: { login, register, mail }  (per 15 minutes / per hour / per hour, per IP)
 *   mailer?: a mailer (src/mailer), none: no email;
 *   appUrl?: the public address of the site, in the links of the emails (default APP_URL; http://localhost:4200 outside production);
 *   requireVerifiedEmail?: a verified address is needed to buy (default REQUIRE_VERIFIED_EMAIL, else: when the mail is real)
 * }
 */
function createAccounts(options = {}) {
  const config = {
    mode: process.env.ACCOUNTS ?? 'auto',
    databaseUrl: process.env.DATABASE_URL,
    secureCookie: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
    ...options.config,
  };
  // `let`: in auto mode a database that cannot be reached at start switches accounts off (see init()).
  let store = options.store !== undefined ? options.store : config.mode === 'off' ? null : createStore(config);
  const isAllowedOrigin = options.isAllowedOrigin ?? (() => true);
  const mailer = options.mailer ?? null;
  const appUrl = String(options.appUrl ?? process.env.APP_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4200')).replace(/\/+$/, '');
  /** Whether the links by email work: there is a store, a mailer and an address for the links to point to. */
  const mailEnabled = () => Boolean(store && mailer?.enabled && appUrl);
  const requireVerifiedEmail = () => {
    if (!mailEnabled()) return false;
    if (options.requireVerifiedEmail !== undefined) return Boolean(options.requireVerifiedEmail);
    return process.env.REQUIRE_VERIFIED_EMAIL ? process.env.REQUIRE_VERIFIED_EMAIL === 'true' : mailer.real;
  };
  /** Which accounts have Premium (server.js sets it once billing is known); open until then. */
  let premiumGate = OPEN_GATE;
  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));

  const setCookie = (res, token, maxAgeSec) => {
    const parts = [`${COOKIE}=${token}`, 'Path=/api', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
    if (config.secureCookie) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  };
  const clearCookie = (res) => setCookie(res, '', 0);

  async function startSession(req, res, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
    await store.createSession({ tokenHash: sha256(token), userId: user.id, expiresAt, userAgent: req.get('user-agent') });
    await store.updateUser(user.id, { lastLoginAt: new Date() });
    setCookie(res, token, SESSION_DAYS * 86_400);
  }

  /** The signed-in user of this request, or null (an expired or unknown cookie is cleared). */
  async function currentUser(req, res) {
    const token = readCookie(req, COOKIE);
    if (!token) return null;
    const tokenHash = sha256(token);
    const session = await store.getSession(tokenHash);
    const now = new Date();
    if (!session || new Date(session.expiresAt) <= now) {
      if (session) await store.deleteSession(tokenHash);
      clearCookie(res);
      return null;
    }
    const user = await store.getUser(session.userId);
    if (!user) {
      clearCookie(res);
      return null;
    }
    if (now - new Date(session.lastSeenAt) > TOUCH_EVERY_MS) await store.touchSession(tokenHash, now);
    req.sessionTokenHash = tokenHash;
    return user;
  }

  const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

  // Accounts off → 503 for everything but /me.
  router.use((req, res, next) => {
    if (!store && req.path !== '/me') return next(disabled());
    next();
  });

  // CSRF: a request that changes something must come from one of our own pages. Browsers always send Origin on
  // POST/PUT/PATCH/DELETE; SameSite=Lax already keeps the cookie off cross-site requests — this is the second lock.
  const sameOriginOnly = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const origin = req.get('origin');
    if (!origin) return next(); // not a browser (curl, server to server): no ambient cookie to abuse
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === req.get('host');
    } catch {
      /* malformed Origin */
    }
    if (sameHost || isAllowedOrigin(origin)) return next();
    next(forbidden('Yêu cầu không đến từ trang của ứng dụng.', 'bad_origin'));
  };
  router.use(sameOriginOnly);

  /** A handler for signed-in users only (401 otherwise); req.user is the user. */
  const signedIn = (handler) =>
    wrap(async (req, res) => {
      req.user = await currentUser(req, res);
      if (!req.user) throw unauthorized();
      await handler(req, res);
    });

  const limits = { login: 10, register: 10, mail: 5, ...options.rateLimits };
  const limiter = (limit, windowMs) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res, next) => next(new AccountError(429, 'rate_limited', 'Thử quá nhiều lần — vui lòng đợi một lúc rồi thử lại.')),
    });
  const loginLimiter = limiter(limits.login, 15 * 60 * 1000);
  const registerLimiter = limiter(limits.register, 60 * 60 * 1000);
  const mailLimiter = limiter(limits.mail, 60 * 60 * 1000); // forgot password / send the verification link again
  const tokenLimiter = limiter(limits.login * 3, 15 * 60 * 1000); // trying links (verify, reset)

  /**
   * Makes a one-time token for the user and starts sending its email; resolves once the token is stored, without
   * waiting for the mail server (a slow or failing server must not show in the answer, nor tell who has an account).
   */
  async function sendLink(user, purpose) {
    const token = crypto.randomBytes(32).toString('base64url');
    const reset = purpose === 'reset';
    await store.createEmailToken({ tokenHash: sha256(token), userId: user.id, purpose, email: user.email, expiresAt: new Date(Date.now() + (reset ? RESET_MINUTES * 60_000 : VERIFY_HOURS * 3_600_000)) });
    const name = user.displayName ?? null;
    const message = reset
      ? resetPasswordMail({ link: `${appUrl}/reset-password?token=${token}`, name, minutes: RESET_MINUTES })
      : verifyEmailMail({ link: `${appUrl}/verify-email?token=${token}`, name, hours: VERIFY_HOURS });
    mailer.send({ to: user.email, ...message }).catch((error) => console.error(`[accounts] could not send the ${purpose} email: ${error.message}`));
  }

  /** True when a link of this purpose was already sent less than a minute ago. */
  async function sentJustNow(user, purpose) {
    const last = await store.lastEmailTokenAt(user.id, purpose);
    return Boolean(last && Date.now() - new Date(last).getTime() < RESEND_GAP_MS);
  }

  // ---------------------------------------------------------------- account
  router.get(
    '/me',
    wrap(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (!store) return res.json({ enabled: false, user: null });
      const user = await currentUser(req, res);
      res.json({ enabled: true, mail: mailEnabled(), user: user && publicUser(user) });
    }),
  );

  router.post(
    '/register',
    registerLimiter,
    wrap(async (req, res) => {
      const body = parse(RegisterSchema, req.body);
      const user = await store.createUser({
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName ?? null,
        termsAcceptedAt: body.acceptTerms ? new Date() : null,
      });
      await startSession(req, res, user);
      // The account exists whether or not the email can be sent; "send it again" is one click away.
      if (mailEnabled()) await sendLink(user, 'verify').catch((error) => console.error(`[accounts] verification link: ${error.message}`));
      res.status(201).json({ user: publicUser(user) });
    }),
  );

  router.post(
    '/login',
    loginLimiter,
    wrap(async (req, res) => {
      const body = parse(LoginSchema, req.body);
      const found = await store.findUserByEmail(body.email);
      // Same work and the same answer whether the email or the password is wrong.
      const ok = await verifyPassword(body.password, found?.passwordHash ?? (await dummyHash()));
      if (!found || !ok) throw unauthorized('Email hoặc mật khẩu không đúng.', 'bad_credentials');
      await startSession(req, res, found);
      res.json({ user: publicUser(found) });
    }),
  );

  router.post(
    '/logout',
    wrap(async (req, res) => {
      const token = readCookie(req, COOKIE);
      if (token) await store.deleteSession(sha256(token));
      clearCookie(res);
      res.status(204).end();
    }),
  );

  router.patch(
    '/me',
    signedIn(async (req, res) => {
      const body = parse(ProfileSchema, req.body);
      res.json({ user: publicUser(await store.updateUser(req.user.id, { displayName: body.displayName })) });
    }),
  );

  router.post(
    '/me/password',
    signedIn(async (req, res) => {
      const body = parse(PasswordSchema, req.body);
      if (!(await verifyPassword(body.currentPassword, req.user.passwordHash))) throw forbidden('Mật khẩu hiện tại không đúng.', 'bad_credentials');
      await store.updateUser(req.user.id, { passwordHash: await hashPassword(body.newPassword) });
      await store.deleteUserSessions(req.user.id, req.sessionTokenHash); // sign out every other device
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- links sent by email
  const needMail = (req, res, next) => (mailEnabled() ? next() : next(new AccountError(503, 'mail_off', 'Chức năng gửi email chưa được bật trên máy chủ này.')));

  router.post(
    '/forgot-password',
    needMail,
    mailLimiter,
    wrap(async (req, res) => {
      const { email } = parse(ForgotSchema, req.body);
      const user = await store.findUserByEmail(email);
      if (user && !(await sentJustNow(user, 'reset'))) await sendLink(user, 'reset');
      // The same answer whether or not the address has an account, so this cannot be used to find out who does.
      res.status(202).json({ ok: true });
    }),
  );

  router.post(
    '/reset-password',
    needMail,
    tokenLimiter,
    wrap(async (req, res) => {
      const body = parse(ResetSchema, req.body);
      const used = await store.consumeEmailToken(sha256(body.token), 'reset', new Date());
      if (!used) throw badRequest('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.', 'invalid_token');
      const user = await store.getUser(used.userId);
      if (!user) throw badRequest('Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một liên kết mới.', 'invalid_token');
      // The link reached the mailbox, so it also proves the address is theirs.
      await store.updateUser(user.id, { passwordHash: await hashPassword(body.password), ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) });
      await store.deleteUserSessions(user.id); // whoever had the old password is signed out everywhere
      clearCookie(res);
      res.status(204).end();
    }),
  );

  router.post(
    '/verify-email',
    needMail,
    tokenLimiter,
    wrap(async (req, res) => {
      const { token } = parse(TokenSchema, req.body);
      const used = await store.consumeEmailToken(sha256(token), 'verify', new Date());
      const user = used && (await store.getUser(used.userId));
      // A link for an address the account no longer has proves nothing.
      if (!user || user.email.toLowerCase() !== used.email.toLowerCase()) throw badRequest('Liên kết không hợp lệ hoặc đã hết hạn. Hãy gửi lại email xác minh.', 'invalid_token');
      if (!user.emailVerifiedAt) await store.updateUser(user.id, { emailVerifiedAt: new Date() });
      res.json({ verified: true });
    }),
  );

  router.post(
    '/verify-email/send',
    needMail,
    mailLimiter,
    signedIn(async (req, res) => {
      if (req.user.emailVerifiedAt) return res.json({ sent: false, alreadyVerified: true });
      if (await sentJustNow(req.user, 'verify')) throw new AccountError(429, 'too_soon', 'Email xác minh vừa được gửi. Vui lòng đợi một phút rồi thử lại.');
      await sendLink(req.user, 'verify');
      res.status(202).json({ sent: true });
    }),
  );

  router.delete(
    '/me',
    signedIn(async (req, res) => {
      const body = parse(DeleteSchema, req.body);
      if (!(await verifyPassword(body.password, req.user.passwordHash))) throw forbidden('Mật khẩu không đúng.', 'bad_credentials');
      await store.deleteUser(req.user.id);
      clearCookie(res);
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- saved reports
  router.get(
    '/reports',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ items: (await store.listItems(req.user.id, REPORT_KIND)).map(toReport) });
    }),
  );

  router.put(
    '/reports',
    signedIn(async (req, res) => {
      const { id, savedAt, ...report } = parse(ReportSchema, req.body);
      const key = reportKey(report);
      const existing = await store.listItems(req.user.id, REPORT_KIND);
      const previous = existing.find((it) => it.key === key);
      // Without Premium: a new report beyond the free few is refused (older ones are never deleted, e.g. after Premium ends).
      if (!previous && existing.length >= FREE_REPORTS && !(await premiumGate.isPremium(req, res))) {
        throw paymentRequired(`Gói miễn phí lưu tối đa ${FREE_REPORTS} báo cáo. Nâng cấp Premium để lưu nhiều hơn.`, 'premium_required');
      }
      // Saving the same type + ward + horizon again keeps its Premium note and tags.
      const { note, tags } = previous?.payload ?? {};
      const item = await store.putItem(req.user.id, REPORT_KIND, key, { ...report, ...(note ? { note } : {}), ...(tags?.length ? { tags } : {}) }, new Date());
      await store.trimItems(req.user.id, REPORT_KIND, MAX_REPORTS);
      res.json({ item: toReport(item) });
    }),
  );

  router.post(
    '/reports/import',
    signedIn(async (req, res) => {
      const { items } = parse(ImportSchema, req.body);
      const existing = new Map((await store.listItems(req.user.id, REPORT_KIND)).map((it) => [it.key, it]));
      const premium = await premiumGate.isPremium(req, res);
      // Oldest first, so the newest copy of a type + ward + horizon is the one kept; never overwrite a newer one.
      const incoming = items
        .map(({ id, savedAt, ...report }) => ({ report, at: savedAt ? new Date(savedAt) : new Date() }))
        .filter(({ at }) => at <= new Date(Date.now() + 60_000))
        .sort((a, b) => a.at - b.at);
      for (const { report, at } of incoming) {
        const key = reportKey(report);
        const current = existing.get(key);
        if (current && new Date(current.updatedAt) >= at) continue;
        if (!current && !premium && existing.size >= FREE_REPORTS) continue; // over the free few: stays in the browser's list
        const kept = current?.payload ?? {};
        existing.set(key, await store.putItem(req.user.id, REPORT_KIND, key, { ...report, ...(kept.note ? { note: kept.note } : {}), ...(kept.tags?.length ? { tags: kept.tags } : {}) }, at));
      }
      await store.trimItems(req.user.id, REPORT_KIND, MAX_REPORTS);
      res.json({ items: (await store.listItems(req.user.id, REPORT_KIND)).map(toReport) });
    }),
  );

  // A Premium note and tags on a saved report; the save time stays as it was.
  router.patch(
    '/reports/:id',
    signedIn(async (req, res) => {
      const { note, tags } = parse(NoteSchema, req.body);
      if (!(await premiumGate.isPremium(req, res))) throw paymentRequired('Ghi chú và thẻ dành cho tài khoản Premium.', 'premium_required');
      const item = /^[0-9a-f-]{36}$/i.test(req.params.id) ? (await store.listItems(req.user.id, REPORT_KIND)).find((it) => it.id === req.params.id) : null;
      if (!item) throw notFound('Không tìm thấy báo cáo.');
      const { note: _note, tags: _tags, ...rest } = item.payload;
      const payload = { ...rest, ...(note ? { note } : {}), ...(tags?.length ? { tags: [...new Set(tags)] } : {}) };
      res.json({ item: toReport(await store.putItem(req.user.id, REPORT_KIND, item.key, payload, new Date(item.updatedAt))) });
    }),
  );

  router.delete(
    '/reports/:id',
    signedIn(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id) || !(await store.deleteItem(req.user.id, REPORT_KIND, req.params.id))) throw notFound('Không tìm thấy báo cáo.');
      res.status(204).end();
    }),
  );

  router.delete(
    '/reports',
    signedIn(async (req, res) => {
      await store.deleteAllItems(req.user.id, REPORT_KIND);
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- career compass (Premium: kept in the account)
  router.get(
    '/career',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const [plans, profiles] = await Promise.all([store.listItems(req.user.id, PLAN_KIND), store.listItems(req.user.id, PROFILE_KIND)]);
      res.json({ profile: profiles[0]?.payload ?? null, plans: plans.map(toPlan) });
    }),
  );

  const premiumOnly = async (req, res) => {
    if (!(await premiumGate.isPremium(req, res))) throw paymentRequired('Lưu kế hoạch nghề nghiệp vào tài khoản dành cho tài khoản Premium.', 'premium_required');
  };

  router.put(
    '/career/profile',
    signedIn(async (req, res) => {
      await premiumOnly(req, res);
      const profile = parse(CareerProfileSchema, req.body);
      await store.putItem(req.user.id, PROFILE_KIND, 'profile', profile, new Date());
      res.json({ profile });
    }),
  );

  router.put(
    '/career/plans/:directionId',
    signedIn(async (req, res) => {
      await premiumOnly(req, res);
      const directionId = parse(z.strictObject({ id: DirectionId }), { id: req.params.directionId }).id;
      const plan = parse(CareerPlanSchema, req.body);
      const existing = await store.listItems(req.user.id, PLAN_KIND);
      if (!existing.some((it) => it.key === directionId) && existing.length >= MAX_CAREER_PLANS) {
        throw new AccountError(409, 'plan_limit', `Tối đa ${MAX_CAREER_PLANS} kế hoạch: hãy xoá bớt một kế hoạch.`);
      }
      res.json({ plan: toPlan(await store.putItem(req.user.id, PLAN_KIND, directionId, { ...plan, done: [...new Set(plan.done)] }, new Date())) });
    }),
  );

  router.delete(
    '/career/plans/:directionId',
    signedIn(async (req, res) => {
      const item = (await store.listItems(req.user.id, PLAN_KIND)).find((it) => it.key === req.params.directionId);
      if (!item) throw notFound('Không tìm thấy kế hoạch.');
      await store.deleteItem(req.user.id, PLAN_KIND, item.id);
      res.status(204).end();
    }),
  );

  // ---------------------------------------------------------------- errors
  router.use((req, res) => res.status(404).json({ statusCode: 404, code: 'not_found', message: 'Không tìm thấy đường dẫn.' }));
  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    if (error instanceof AccountError) return res.status(error.status).json({ statusCode: error.status, code: error.code, message: error.message });
    if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
      return res.status(400).json({ statusCode: 400, code: 'invalid', message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    console.error('[accounts]', error);
    res.status(500).json({ statusCode: 500, code: 'server_error', message: 'Lỗi máy chủ, vui lòng thử lại.' });
  });

  let purgeTimer;
  return {
    router,
    get enabled() {
      return !!store;
    },
    get store() {
      return store;
    },
    /** The email links work (verify an address, reset a password). */
    get mailEnabled() {
      return mailEnabled();
    },
    /** A verified address is needed to buy (billing asks). */
    get requireVerifiedEmail() {
      return requireVerifiedEmail();
    },
    /** For other modules (billing, paid reports): the signed-in user of a request, or null. Needs `enabled`. */
    userOf: (req, res) => currentUser(req, res),
    /** The Premium gate (src/billing/premium-gate.js), for the limits of saved reports. */
    usePremiumGate(gate) {
      premiumGate = gate;
    },
    /** The CSRF check of this router, for other routers that use the session cookie. */
    sameOriginOnly,
    async init() {
      if (!store) return;
      try {
        await store.init();
      } catch (error) {
        // ACCOUNTS=postgres: the operator asked for accounts, so stop. auto: keep every other tool running.
        if (config.mode === 'postgres') throw error;
        console.error(`[accounts] database unavailable (${error.message}) — accounts are off until it is fixed.`);
        await store.close().catch(() => {});
        store = null;
        return;
      }
      // Expired sessions are refused anyway; this only keeps the table small.
      purgeTimer = setInterval(() => store.purgeExpiredSessions(new Date()).catch(() => {}), 6 * 60 * 60 * 1000);
      purgeTimer.unref();
    },
    async close() {
      clearInterval(purgeTimer);
      await store?.close();
    },
  };
}

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.displayName ?? null, createdAt: u.createdAt, emailVerified: Boolean(u.emailVerifiedAt) });

module.exports = { createAccounts, ReportSchema, COOKIE };
