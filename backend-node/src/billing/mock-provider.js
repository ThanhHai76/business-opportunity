'use strict';
/**
 * Pretend payment provider for development and tests (BILLING_PROVIDER=mock; refused in production). Its checkout page
 * is served by this API (/api/billing/mock/checkout/:orderCode), and "paying" there goes through the same signed
 * webhook check as a real provider, so the whole purchase can be tried without money.
 *
 * A real provider (PayOS) implements the same members:
 *   name
 *   createPayment({ order, description, apiBase, returnUrl, cancelUrl }) → { checkoutUrl, providerRef }
 *   verifyWebhook(body) → { orderCode, amountVnd, reference }  (throws when the signature or the body is wrong)
 */
const crypto = require('node:crypto');

function createMockProvider({ secret = crypto.randomBytes(32).toString('hex') } = {}) {
  const sign = (data) => crypto.createHmac('sha256', secret).update(`amount=${data.amount}&orderCode=${data.orderCode}&reference=${data.reference}`).digest('hex');

  return {
    name: 'mock',

    async createPayment({ order, apiBase, returnUrl, cancelUrl }) {
      const query = new URLSearchParams({ returnUrl, cancelUrl });
      return { checkoutUrl: `${apiBase}/api/billing/mock/checkout/${order.orderCode}?${query}`, providerRef: `MOCK-${order.orderCode}` };
    },

    /** The notification the provider would POST to /api/billing/webhook/mock once the money has arrived. */
    paidWebhook(order) {
      const data = { orderCode: order.orderCode, amount: order.amountVnd, reference: `MOCK-${order.orderCode}-${Date.now()}` };
      return { data, signature: sign(data) };
    },

    verifyWebhook(body) {
      const data = body?.data;
      const ok =
        data &&
        Number.isSafeInteger(data.orderCode) &&
        Number.isSafeInteger(data.amount) &&
        typeof data.reference === 'string' &&
        data.reference.length <= 120 &&
        typeof body.signature === 'string';
      if (!ok) throw new Error('malformed webhook');
      const expected = Buffer.from(sign(data));
      const given = Buffer.from(body.signature);
      if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new Error('bad signature');
      return { orderCode: data.orderCode, amountVnd: data.amount, reference: data.reference };
    },
  };
}

module.exports = { createMockProvider };
