'use strict';
/**
 * Paid reports — mounted by server.js at /api/reports. Each report uses one credit (bought at /api/billing).
 *
 *   POST /           { type, ward, horizon, assumptions } → 201 { report, credits }   (402 no_credits)
 *   GET  /           { items }   the user's reports, newest first (without their content)
 *   GET  /:id        { report }  with its content
 *   GET  /:id/print  the report as a printable page (the browser saves it as PDF); a Premium account with saved
 *                    details gets them on it (?brand=0: the standard page)
 *   GET/PUT/DELETE /brand  the broker details printed on the reports (Premium)
 *   GET  /sample     the free sample of a report, printable, for anyone (no account, no credit)
 *
 * The server computes the report (src/reports/build.js) and stores it frozen: the page cannot change the figures,
 * and the report reads the same later. Input that cannot be reported on (unknown ward, no score) is refused before a
 * credit is used.
 */
const express = require('express');
const { z } = require('zod');
const { AccountError, badRequest, notFound, paymentRequired } = require('../accounts/errors');
const { OPEN_GATE } = require('../billing/premium-gate');
const { signedInWith, finishRouter, UUID } = require('../billing/common');
const { buildFeasibilityReport, reportTitle } = require('./build');
const { printPage } = require('./print');

const KIND = 'opportunity_feasibility';

/**
 * The free sample of the paid report: a real report, built from the same data and code, for a plain café plan in Phường
 * Cầu Giấy (the defaults of the calculator, frontend/src/app/opportunity/op-feasibility.ts). Public, uses no credit.
 */
const SAMPLE_INPUT = {
  type: 'cafe',
  ward: 'phuong-cau-giay',
  horizon: 'now',
  assumptions: { basis: 'day', customers: 120, ticket: 45_000, daysOpen: 30, sizeM2: 60, rentPerM2: 350_000, cogsPct: 30, staff: 4, salary: 9_000_000, utilitiesPerM2: 115_000, otherPct: 4.3, setupPerM2: 5_400_000, depositMonths: 3, budget: 500_000_000, rampMonths: 6, rampStartPct: 50 },
};
const LISTED = 100;

const n = (min, max) => z.number().finite().min(min).max(max);
/** The calculator's inputs (frontend/src/app/opportunity/op-feasibility.ts, Assumptions). */
const AssumptionsSchema = z.strictObject({
  basis: z.enum(['day', 'month']),
  customers: n(0, 1_000_000),
  ticket: n(0, 10_000_000_000),
  daysOpen: n(1, 31),
  sizeM2: n(1, 1_000_000),
  rentPerM2: n(0, 100_000_000),
  cogsPct: n(0, 100),
  staff: n(0, 10_000),
  salary: n(0, 10_000_000_000),
  utilitiesPerM2: n(0, 100_000_000),
  otherPct: n(0, 100),
  setupPerM2: n(0, 10_000_000_000),
  depositMonths: n(0, 36),
  budget: n(0, 1e14),
  rampMonths: n(0, 36),
  rampStartPct: n(0, 100),
});
const CreateSchema = z.strictObject({
  type: z.string().regex(/^[a-z0-9-]{1,40}$/),
  ward: z.string().regex(/^[a-z0-9-]{1,60}$/),
  horizon: z.enum(['now', '2030']),
  assumptions: AssumptionsSchema,
});

const listView = (r) => ({ id: r.id, kind: r.kind, title: r.title, createdAt: r.createdAt, type: r.input?.type, ward: r.input?.ward, horizon: r.input?.horizon });
const fullView = (r) => ({ ...listView(r), content: r.content });

const BRAND_KIND = 'broker_brand';
const BRAND_KEY = 'profile';
/** The broker's details printed on a report (Premium): text only, everything is escaped when printed. */
const Text = (max) => z.string().trim().max(max);
const BrandSchema = z.strictObject({
  company: Text(80),
  name: Text(80),
  phone: Text(30),
  email: Text(120),
  note: Text(300),
});
const brandView = (item) => (item ? BrandSchema.parse(item.payload) : null);

/** @param options { accounts, premium? } premium: the gate (src/billing/premium-gate.js); open by default. */
function createPaidReports({ accounts, premium = OPEN_GATE, onEvent = null }) {
  const store = () => accounts.store;
  const brandOf = async (userId) => brandView((await store().listItems(userId, BRAND_KIND))[0]);
  const signedIn = signedInWith(accounts);
  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  router.use(accounts.sameOriginOnly);
  router.use((req, res, next) =>
    accounts.enabled ? next() : next(new AccountError(503, 'accounts_disabled', 'Tài khoản chưa được bật trên máy chủ này.')),
  );

  const findOwn = async (req) => {
    const report = UUID.test(req.params.id) ? await store().getPaidReport(req.user.id, req.params.id) : null;
    if (!report) throw notFound('Không tìm thấy báo cáo.');
    return report;
  };

  router.post(
    '/',
    signedIn(async (req, res) => {
      const parsed = CreateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw badRequest(`Dữ liệu không hợp lệ${issue?.path?.length ? ` (${issue.path.join('.')})` : ''}.`);
      }
      const input = parsed.data;
      const content = buildFeasibilityReport(input); // throws 400 before any credit is used
      const { report, credits } = await store().createPaidReport(req.user.id, { kind: KIND, title: reportTitle(content), input, content });
      res.status(201).json({ report: listView(report), credits });
    }),
  );

  router.get(
    '/',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ items: (await store().listPaidReports(req.user.id, LISTED)).map(listView) });
    }),
  );

  // The free sample, built once (the data does not change while the server runs). Before /:id, like "brand".
  let samplePage = null;
  router.get('/sample', (req, res) => {
    // A visitor to the API port during development is sent on to the page's own port.
    const appUrl = process.env.APP_URL || (/^localhost:8000$/.test(req.get('host') ?? '') ? 'http://localhost:4200' : '');
    const key = appUrl;
    if (!samplePage || samplePage.key !== key) {
      const content = buildFeasibilityReport(SAMPLE_INPUT);
      const report = { id: 'sample', kind: KIND, title: reportTitle(content), createdAt: new Date().toISOString(), input: SAMPLE_INPUT, content };
      samplePage = { key, html: printPage(report, { sample: true, appUrl }) };
    }
    onEvent?.('sample_report', 'opened');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.type('html').send(samplePage.html);
  });

  // The broker's details for the printed report (Premium). Before /:id, so "brand" is not read as a report id.
  router.get(
    '/brand',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ brand: await brandOf(req.user.id), premium: await premium.isPremium(req, res) });
    }),
  );

  router.put(
    '/brand',
    signedIn(async (req, res) => {
      if (!(await premium.isPremium(req, res))) throw paymentRequired('Báo cáo mang thương hiệu của bạn dành cho tài khoản Premium.', 'premium_required');
      const parsed = BrandSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw badRequest('Thông tin thương hiệu không hợp lệ (mỗi mục có giới hạn độ dài).');
      if (!parsed.data.company && !parsed.data.name) throw badRequest('Nhập tên công ty hoặc tên của bạn.');
      await store().putItem(req.user.id, BRAND_KIND, BRAND_KEY, parsed.data, new Date());
      res.json({ brand: parsed.data });
    }),
  );

  router.delete(
    '/brand',
    signedIn(async (req, res) => {
      await store().deleteAllItems(req.user.id, BRAND_KIND);
      res.status(204).end();
    }),
  );

  router.get(
    '/:id',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ report: fullView(await findOwn(req)) });
    }),
  );

  router.get(
    '/:id/print',
    signedIn(async (req, res) => {
      const report = await findOwn(req);
      // A Premium account with saved details gets its own branding, unless ?brand=0 asks for the standard page.
      const saved = (await premium.isPremium(req, res)) ? await brandOf(req.user.id) : null;
      const brand = req.query.brand === '0' ? null : saved;
      res.setHeader('Cache-Control', 'private, no-store');
      // `canSwitch`: the page offers the other version (with / without the broker's details).
      res.type('html').send(printPage(report, { brand, canSwitch: Boolean(saved) }));
    }),
  );

  finishRouter(router, 'reports');
  return { router };
}

module.exports = { createPaidReports, AssumptionsSchema };
