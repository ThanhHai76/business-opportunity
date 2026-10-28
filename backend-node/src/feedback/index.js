'use strict';
/**
 * Reports of wrong figures — mounted by server.js at /api/feedback.
 *
 *   POST /data-report   { kind: 'ward' | 'source', target, targetName?, page?, message, contact?, website? }
 *                       → 201 { ok: true, id }
 *
 * Anyone can send one (no account needed; a signed-in sender is noted). `target` is a ward's slug (it must be a ward of the
 * map) or a source's id. `website` is a trap for bots: a real visitor leaves it empty, and a filled one is answered as
 * sent but dropped. Limits: a few reports an hour per address, and a daily cap for the whole site, so the table cannot be flooded.
 *
 * The person who runs the site reads them at /admin/reports (the page of the app), through:
 *   GET   /admin/reports?status=new|checked|fixed|rejected&limit=N   → { reports: [...] }
 *   PATCH /admin/reports/:id   { status }                              → { ok: true }
 *   GET   /admin/me                                                    → { admin: boolean }  (never an error: the account menu asks it to show or hide the link)
 * Only a signed-in account whose email is verified and is listed in ADMIN_EMAILS (comma separated) may call them:
 * 401 when not signed in, 403 for anyone else (and for everyone while ADMIN_EMAILS is empty).
 *
 * Kept in the accounts database (table data_reports) when there is one; otherwise in memory (lost on restart) and
 * written to the log. `npm run reports:list` prints the latest from the database.
 */
const crypto = require('node:crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { AccountError, badRequest } = require('../accounts/errors');
const { finishRouter, wrap } = require('../billing/common');
const { WARD_BY_SLUG } = require('../opportunity/model');

const STATUSES = ['new', 'checked', 'fixed', 'rejected'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/i;
/** Memory kept when there is no database. */
const MEMORY_MAX = 500;

const Text = (min, max) => z.string().trim().min(min).max(max);
const ReportSchema = z.strictObject({
  kind: z.enum(['ward', 'source']),
  target: Text(1, 80).regex(ID),
  targetName: Text(1, 120).optional(),
  page: Text(1, 40).regex(ID).optional(),
  message: Text(10, 1000),
  contact: Text(1, 120).optional(),
  website: z.string().max(200).optional(),
});

/** The same fields whichever store the report came from (the database keeps snake_case, the memory camelCase). */
const reportView = (r) => ({
  id: r.id,
  kind: r.kind,
  target: r.target,
  targetName: r.targetName ?? r.target_name ?? null,
  page: r.page ?? null,
  message: r.message,
  contact: r.contact ?? null,
  status: r.status,
  createdAt: new Date(r.createdAt ?? r.created_at).toISOString(),
});

function adminEmailsFrom(value) {
  return new Set(String(value ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

function createFeedback({ accounts, rateLimits = {}, adminEmails = process.env.ADMIN_EMAILS } = {}) {
  const admins = adminEmailsFrom(adminEmails);
  const memory = [];
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  router.use(accounts.sameOriginOnly);

  const limited = (windowMs, limit, keyGenerator) =>
    rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      ...(keyGenerator ? { keyGenerator, validate: { keyGeneratorIpFallback: false } } : {}),
      handler: (req, res, next) => next(new AccountError(429, 'rate_limited', 'Bạn gửi quá nhiều báo cáo. Hãy thử lại sau.')),
    });
  router.use('/data-report', limited(60 * 60 * 1000, rateLimits.perHour ?? 5));
  router.use('/data-report', limited(24 * 60 * 60 * 1000, rateLimits.perDay ?? 300, () => 'site'));

  router.post(
    '/data-report',
    wrap(async (req, res) => {
      const parsed = ReportSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('Báo cáo chưa hợp lệ: hãy mô tả số liệu sai (từ 10 đến 1000 ký tự).');
      const r = parsed.data;
      // A bot filled the hidden field: pretend it worked.
      if (r.website) return res.status(201).json({ ok: true, id: crypto.randomUUID() });
      if (r.kind === 'ward' && !WARD_BY_SLUG.has(r.target)) throw badRequest('Không có phường/xã này trên bản đồ.');
      const user = accounts.enabled ? await accounts.userOf(req, res) : null;
      const report = { kind: r.kind, target: r.target, targetName: r.targetName ?? null, page: r.page ?? null, message: r.message, contact: r.contact ?? null, userId: user?.id ?? null };
      let id;
      if (accounts.enabled && typeof accounts.store?.addDataReport === 'function') {
        id = (await accounts.store.addDataReport(report)).id;
      } else {
        id = crypto.randomUUID();
        memory.push({ id, ...report, createdAt: new Date() });
        if (memory.length > MEMORY_MAX) memory.shift();
        console.warn(`[feedback] ${r.kind} ${r.target}: ${r.message.replace(/\s+/g, ' ').slice(0, 200)}`);
      }
      res.status(201).json({ ok: true, id });
    }),
  );

  const isAdmin = (user) => Boolean(user?.emailVerifiedAt) && admins.has(String(user.email).toLowerCase());

  /** The signed-in, verified administrator; throws 401 or 403. */
  async function requireAdmin(req, res) {
    const user = accounts.enabled ? await accounts.userOf(req, res) : null;
    if (!user) throw new AccountError(401, 'not_signed_in', 'Hãy đăng nhập.');
    if (!isAdmin(user)) throw new AccountError(403, 'forbidden', 'Tài khoản này không có quyền xem báo cáo.');
  }

  router.get(
    '/admin/me',
    wrap(async (req, res) => {
      const user = accounts.enabled ? await accounts.userOf(req, res) : null;
      res.set('Cache-Control', 'no-store').json({ admin: isAdmin(user) });
    }),
  );

  router.get(
    '/admin/reports',
    wrap(async (req, res) => {
      await requireAdmin(req, res);
      const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null;
      if (status && !STATUSES.includes(status)) throw badRequest('Trạng thái không hợp lệ.');
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const rows = await accounts.store.listDataReports(limit, status);
      res.set('Cache-Control', 'no-store').json({ reports: rows.map(reportView) });
    }),
  );

  router.patch(
    '/admin/reports/:id',
    wrap(async (req, res) => {
      await requireAdmin(req, res);
      const parsed = z.strictObject({ status: z.enum(STATUSES) }).safeParse(req.body);
      if (!parsed.success || !UUID.test(req.params.id)) throw badRequest('Yêu cầu chưa hợp lệ.');
      if (!(await accounts.store.setDataReportStatus(req.params.id, parsed.data.status))) throw new AccountError(404, 'not_found', 'Không có báo cáo này.');
      res.set('Cache-Control', 'no-store').json({ ok: true });
    }),
  );

  finishRouter(router, 'feedback');
  return { router, reports: () => [...memory] };
}

module.exports = { createFeedback };
