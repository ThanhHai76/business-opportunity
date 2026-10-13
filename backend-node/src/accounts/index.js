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
 */
const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { AccountError, badRequest, unauthorized, forbidden, notFound, disabled } = require('./errors');
const { hashPassword, verifyPassword, dummyHash } = require('./passwords');
const { MemoryStore } = require('./memory-store');

const COOKIE = 'h100_sid';
const SESSION_DAYS = 30;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const MAX_REPORTS = 30;
const REPORT_KIND = 'opportunity_report';

// ---------------------------------------------------------------- validation
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Email không hợp lệ.' }));
const Password = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.').max(200, 'Mật khẩu quá dài.');
const DisplayName = z.string().trim().max(80).transform((s) => s || null);
const RegisterSchema = z.strictObject({ email: Email, password: Password, displayName: DisplayName.optional() });
const LoginSchema = z.strictObject({ email: Email, password: z.string().min(1).max(200) });
const ProfileSchema = z.strictObject({ displayName: DisplayName });
const PasswordSchema = z.strictObject({ currentPassword: z.string().min(1).max(200), newPassword: Password });
const DeleteSchema = z.strictObject({ password: z.string().min(1).max(200) });

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
 *   rateLimits?: { login, register }        (per 15 minutes / per hour, per IP)
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
  router.use((req, res, next) => {
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
  });

  /** A handler for signed-in users only (401 otherwise); req.user is the user. */
  const signedIn = (handler) =>
    wrap(async (req, res) => {
      req.user = await currentUser(req, res);
      if (!req.user) throw unauthorized();
      await handler(req, res);
    });

  const limits = { login: 10, register: 10, ...options.rateLimits };
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

  // ---------------------------------------------------------------- account
  router.get(
    '/me',
    wrap(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (!store) return res.json({ enabled: false, user: null });
      const user = await currentUser(req, res);
      res.json({ enabled: true, user: user && publicUser(user) });
    }),
  );

  router.post(
    '/register',
    registerLimiter,
    wrap(async (req, res) => {
      const body = parse(RegisterSchema, req.body);
      const user = await store.createUser({ email: body.email, passwordHash: await hashPassword(body.password), displayName: body.displayName ?? null });
      await startSession(req, res, user);
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
      const item = await store.putItem(req.user.id, REPORT_KIND, reportKey(report), report, new Date());
      await store.trimItems(req.user.id, REPORT_KIND, MAX_REPORTS);
      res.json({ item: toReport(item) });
    }),
  );

  router.post(
    '/reports/import',
    signedIn(async (req, res) => {
      const { items } = parse(ImportSchema, req.body);
      const existing = new Map((await store.listItems(req.user.id, REPORT_KIND)).map((it) => [it.key, it]));
      // Oldest first, so the newest copy of a type + ward + horizon is the one kept; never overwrite a newer one.
      const incoming = items
        .map(({ id, savedAt, ...report }) => ({ report, at: savedAt ? new Date(savedAt) : new Date() }))
        .filter(({ at }) => at <= new Date(Date.now() + 60_000))
        .sort((a, b) => a.at - b.at);
      for (const { report, at } of incoming) {
        const key = reportKey(report);
        const current = existing.get(key);
        if (current && new Date(current.updatedAt) >= at) continue;
        existing.set(key, await store.putItem(req.user.id, REPORT_KIND, key, report, at));
      }
      await store.trimItems(req.user.id, REPORT_KIND, MAX_REPORTS);
      res.json({ items: (await store.listItems(req.user.id, REPORT_KIND)).map(toReport) });
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

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.displayName ?? null, createdAt: u.createdAt });

module.exports = { createAccounts, ReportSchema, COOKIE };
