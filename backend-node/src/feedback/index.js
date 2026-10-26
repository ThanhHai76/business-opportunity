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

function createFeedback({ accounts, rateLimits = {} } = {}) {
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

  finishRouter(router, 'feedback');
  return { router, reports: () => [...memory] };
}

module.exports = { createFeedback };
