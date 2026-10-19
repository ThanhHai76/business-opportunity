'use strict';
/**
 * Paid reports — mounted by server.js at /api/reports. Each report uses one credit (bought at /api/billing).
 *
 *   POST /           { type, ward, horizon, assumptions } → 201 { report, credits }   (402 no_credits)
 *   GET  /           { items }   the user's reports, newest first (without their content)
 *   GET  /:id        { report }  with its content
 *   GET  /:id/print  the report as a printable page (the browser saves it as PDF)
 *
 * The server computes the report (src/reports/build.js) and stores it frozen: the page cannot change the figures,
 * and the report reads the same later. Input that cannot be reported on (unknown ward, no score) is refused before a
 * credit is used.
 */
const express = require('express');
const { z } = require('zod');
const { AccountError, badRequest, notFound } = require('../accounts/errors');
const { signedInWith, finishRouter, UUID } = require('../billing/common');
const { buildFeasibilityReport, reportTitle } = require('./build');
const { printPage } = require('./print');

const KIND = 'opportunity_feasibility';
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

/** @param options { accounts } */
function createPaidReports({ accounts }) {
  const store = () => accounts.store;
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
      res.setHeader('Cache-Control', 'private, no-store');
      res.type('html').send(printPage(report));
    }),
  );

  finishRouter(router, 'reports');
  return { router };
}

module.exports = { createPaidReports, AssumptionsSchema };
