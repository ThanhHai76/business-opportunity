'use strict';
/**
 * Visit statistics, kept by the site itself: no third party, no cookie, no IP address, no account id. Only counters,
 * one per (day, event, key), so there is nothing about a person to leak or to ask to delete.
 *
 *   POST /event   { event, key? }                         → 204   (from the pages; a browser with Do Not Track sends nothing)
 *   GET  /admin/summary?days=30                           → { since, days, rows: [{ day, event, key, n }] }   (administrators)
 *
 * Events a page may send: page_view (key = the path, ids folded: /phuong-xa/:slug), signup, ward_lookup, score_help
 * (key = the tool). The server records the others itself, where the page could not be trusted: checkout_start and
 * order_paid (key = the product) from billing, sample_report when the sample report is opened.
 * The day is the Vietnamese one (UTC+7). Kept in the accounts database when there is one, in memory otherwise.
 */
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { AccountError, badRequest } = require('../accounts/errors');
const { createAdminGate } = require('../accounts/admin');
const { finishRouter, wrap } = require('../billing/common');

/** Events a page is allowed to send. */
const PAGE_EVENTS = ['page_view', 'signup', 'ward_lookup', 'score_help'];
/** Pages counted by name; any other path is counted as /other, so a made-up address cannot fill the table. */
const ROOTS = new Set(['opportunity-map', 'time-machine', 'living-score', 'future-map', 'property-intelligence', 'career', 'premium', 'terms', 'privacy', 'refund', 'giai-thich-diem', 'phuong-xa', 'forgot-password', 'reset-password', 'verify-email']);
/** The sub-pages of the tools that have them; any other second segment is dropped, so only a few distinct paths exist. */
const SUBPAGES = { 'living-score': new Set(['explore', 'area', 'compare', 'ai', 'saved', 'profile']), 'property-intelligence': new Set(['map', 'projects']) };
const MAX_DAYS = 400;

/** The Vietnamese calendar day of a moment: 2026-10-27. */
const dayOf = (now = Date.now()) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);

/** "/phuong-xa/phuong-cau-giay?x=1" → "/phuong-xa/:slug"; "/living-score/area/phuong-x" → "/living-score/area/:slug". */
function pathKey(value) {
  const segments = String(value ?? '').split(/[?#]/)[0].split('/').filter(Boolean);
  if (!segments.length) return '/';
  const root = segments[0];
  if (!ROOTS.has(root)) return '/other';
  if (root === 'phuong-xa') return segments[1] ? '/phuong-xa/:slug' : '/phuong-xa';
  const sub = SUBPAGES[root]?.has(segments[1]) ? segments[1] : null;
  if (!sub) return `/${root}`;
  return segments[2] && (sub === 'area' || sub === 'projects') ? `/${root}/${sub}/:slug` : `/${root}/${sub}`;
}

/** A short label: a tool or a product. Anything else is dropped to an empty key. */
const labelKey = (value) => {
  const s = String(value ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s;
};

const EventSchema = z.strictObject({
  event: z.enum(PAGE_EVENTS),
  key: z.string().max(200).optional(),
});

function createAnalytics({ accounts, rateLimits = {}, adminEmails = process.env.ADMIN_EMAILS } = {}) {
  // Without a database the counters live in memory (lost on restart), like the other stores.
  const memory = new Map();
  const memorySink = {
    async bumpAnalytics(day, event, key) {
      const id = `${day}|${event}|${key}`;
      memory.set(id, (memory.get(id) ?? 0) + 1);
    },
    async analyticsRows(sinceDay) {
      return [...memory].map(([id, n]) => ({ day: id.split('|')[0], event: id.split('|')[1], key: id.split('|').slice(2).join('|'), n })).filter((r) => r.day >= sinceDay);
    },
  };
  const sink = () => (accounts.enabled && accounts.store?.bumpAnalytics ? accounts.store : memorySink);
  const admin = createAdminGate(accounts, adminEmails);

  /** Counts one event; never throws (a statistics failure must not break a purchase or a page). */
  function record(event, key = '') {
    const clean = event === 'page_view' ? pathKey(key) : labelKey(key);
    sink().bumpAnalytics(dayOf(), event, clean).catch((error) => console.warn(`[analytics] ${event}: ${error.message}`));
  }

  const router = express.Router();
  router.use(express.json({ limit: '2kb' }));
  router.use(accounts.sameOriginOnly);
  router.use(
    '/event',
    rateLimit({
      windowMs: 60_000,
      limit: rateLimits.perMinute ?? 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res, next) => next(new AccountError(429, 'rate_limited', 'Quá nhiều yêu cầu.')),
    }),
  );

  router.post(
    '/event',
    wrap(async (req, res) => {
      const parsed = EventSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('Sự kiện không hợp lệ.');
      record(parsed.data.event, parsed.data.key);
      res.status(204).end();
    }),
  );

  router.get(
    '/admin/summary',
    wrap(async (req, res) => {
      await admin.require(req, res);
      const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(Number(req.query.days)) || 30));
      const since = dayOf(Date.now() - (days - 1) * 86_400_000);
      const rows = await sink().analyticsRows(since);
      res.set('Cache-Control', 'no-store').json({ since, days, rows });
    }),
  );

  finishRouter(router, 'analytics');
  return { router, record };
}

module.exports = { createAnalytics, pathKey, dayOf };
