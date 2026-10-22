'use strict';
/**
 * Premium-only data of the tools: the server sends it only to accounts with Premium.
 *   Business Opportunity Map  the 2030 horizon of the whole map, of comparisons and of AI answers
 *                             (one ward's 2030 scores stay free: the preview that shows what Premium adds)
 *   Property Intelligence     the planning layers of 2030 and 2045
 *   Career compass            the plans and answers kept in the account (src/accounts: /career, up to 5 plans), and the
 *                             broker details printed on the PDF plan (/api/reports/brand)
 * Features computed in the page from data everyone gets (custom weights, the full business plan, CSV export, the
 * number of watched items, the career compass PDF and "where to live for your work") are limited in the page; there is
 * nothing more to hide on the server for them.
 *
 * PREMIUM_GATING: auto (default) — on only while Premium can be bought (payments on and accounts on); on; off.
 * Off, everything is open: nobody is locked out of a feature there is no way to buy.
 */
const { HttpError } = require('../living-score/common/http');

/** No gate: every request counts as Premium (the tools created on their own: tests, scripts). */
const OPEN_GATE = Object.freeze({
  enabled: false,
  async isPremium() {
    return true;
  },
  async require() {},
});

/** 402 with code premium_required: the page shows its Premium offer instead of an error. */
function premiumRequired(feature) {
  const error = new HttpError(402, `${feature} dành cho tài khoản Premium. Đăng nhập và nâng cấp Premium để dùng.`);
  error.code = 'premium_required';
  return error;
}

/**
 * @param options {
 *   accounts: the accounts module (who is signed in, and the store with premiumUntil);
 *   forSale: () => boolean   whether Premium can be bought now (payments on);
 *   mode?: 'auto'|'on'|'off' (default PREMIUM_GATING, else auto);
 *   clock?: () => Date       (tests)
 * }
 */
function createPremiumGate(options) {
  const { accounts } = options;
  const forSale = options.forSale ?? (() => false);
  const mode = options.mode ?? (process.env.PREMIUM_GATING || 'auto');
  const clock = options.clock ?? (() => new Date());
  const enabled = () => Boolean(accounts?.enabled) && mode !== 'off' && (mode === 'on' || Boolean(forSale()));

  async function isPremium(req, res) {
    if (!enabled()) return true;
    const user = await accounts.userOf(req, res);
    if (!user) return false;
    const until = await accounts.store.premiumUntil(user.id);
    return Boolean(until && new Date(until) > clock());
  }

  return {
    get enabled() {
      return enabled();
    },
    isPremium,
    /** Throws 402 premium_required unless the request comes from a Premium account (or the gate is off). */
    async require(req, res, feature) {
      if (!(await isPremium(req, res))) throw premiumRequired(feature);
    },
  };
}

module.exports = { createPremiumGate, OPEN_GATE, premiumRequired };
