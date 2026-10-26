'use strict';
/**
 * PayOS (payos.vn): VietQR bank transfers. BILLING_PROVIDER=payos, with the three keys of the payment channel:
 *
 *   PAYOS_CLIENT_ID, PAYOS_API_KEY      identify the shop when this server calls PayOS
 *   PAYOS_CHECKSUM_KEY                  signs what this server sends, and checks what PayOS sends back (HMAC-SHA256)
 *
 * Optional: PAYOS_API_URL (default https://api-merchant.payos.vn), PAYOS_ORDER_OFFSET (added to our order codes, so a
 * test database and the real one never send PayOS the same code: PayOS refuses a code it has already seen),
 * PAYOS_DESCRIPTION_MAX (default 9: the memo limit for accounts not linked through PayOS; 25 for linked ones).
 *
 * The same interface as mock-provider.js:
 *   createPayment({ order, description, returnUrl, cancelUrl }) → { checkoutUrl, providerRef }
 *   verifyWebhook(body) → { orderCode, amountVnd, reference } | null  (null: signed, but not a payment to credit)
 *
 * PayOS docs: https://payos.vn/docs/api/ (payment-requests, confirm-webhook) and
 * https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/ (the signature of the webhook's data).
 */
const crypto = require('node:crypto');
const { AccountError } = require('../accounts/errors');

const DEFAULT_API = 'https://api-merchant.payos.vn';
const TIMEOUT_MS = 15_000;

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');

/** The string PayOS signs for a payment request: these five fields, in this (alphabetical) order. */
function requestSignature({ amount, cancelUrl, description, orderCode, returnUrl }, checksumKey) {
  return hmac(checksumKey, `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`);
}

/** The string PayOS signs for the data of a webhook: every key in alphabetical order, null and undefined as "". */
function dataSignature(data, checksumKey) {
  const text = Object.keys(data)
    .sort()
    .map((key) => {
      let value = data[key];
      if (value === null || value === undefined || value === 'null' || value === 'undefined') value = '';
      else if (typeof value === 'object') value = JSON.stringify(value);
      return `${key}=${value}`;
    })
    .join('&');
  return hmac(checksumKey, text);
}

const sameHex = (a, b) => {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** A short memo for the buyer's bank app, without spaces or accents (some banks drop them). */
const memo = (orderCode, max) => `HCV${orderCode}`.slice(0, max);

function createPayosProvider(options = {}, env = process.env) {
  const clientId = options.clientId ?? env.PAYOS_CLIENT_ID;
  const apiKey = options.apiKey ?? env.PAYOS_API_KEY;
  const checksumKey = options.checksumKey ?? env.PAYOS_CHECKSUM_KEY;
  const missing = [['PAYOS_CLIENT_ID', clientId], ['PAYOS_API_KEY', apiKey], ['PAYOS_CHECKSUM_KEY', checksumKey]].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`BILLING_PROVIDER=payos needs ${missing.join(', ')}`);
  const apiUrl = String(options.apiUrl ?? env.PAYOS_API_URL ?? DEFAULT_API).replace(/\/+$/, '');
  const offset = Number(options.orderOffset ?? env.PAYOS_ORDER_OFFSET ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('PAYOS_ORDER_OFFSET must be a whole number ≥ 0');
  const descriptionMax = Number(options.descriptionMax ?? env.PAYOS_DESCRIPTION_MAX ?? 9);
  const fetchImpl = options.fetch ?? fetch;
  const headers = { 'content-type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey };

  /** Calls the PayOS API; anything but { code: '00' } is an error the buyer sees as "try again". */
  async function call(path, body) {
    let res;
    let json;
    try {
      res = await fetchImpl(`${apiUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
      json = await res.json();
    } catch (error) {
      console.error(`[billing] PayOS ${path} unreachable: ${error.message}`);
      throw new AccountError(502, 'payment_provider_unavailable', 'Cổng thanh toán đang không phản hồi. Vui lòng thử lại sau ít phút.');
    }
    if (!res.ok || json?.code !== '00' || !json.data) {
      console.error(`[billing] PayOS ${path} refused: HTTP ${res.status}, code ${json?.code}, ${json?.desc}`);
      throw new AccountError(502, 'payment_provider_error', 'Cổng thanh toán từ chối tạo đơn. Vui lòng thử lại sau.');
    }
    return json.data;
  }

  return {
    name: 'payos',

    async createPayment({ order, returnUrl, cancelUrl }) {
      const request = {
        orderCode: order.orderCode + offset,
        amount: order.amountVnd,
        description: memo(order.orderCode, descriptionMax),
        cancelUrl,
        returnUrl,
      };
      const expiredAt = order.expiresAt ? Math.floor(new Date(order.expiresAt).getTime() / 1000) : undefined;
      const data = await call('/v2/payment-requests', { ...request, ...(expiredAt ? { expiredAt } : {}), signature: requestSignature(request, checksumKey) });
      if (typeof data.checkoutUrl !== 'string' || !/^https:\/\//.test(data.checkoutUrl)) {
        throw new AccountError(502, 'payment_provider_error', 'Cổng thanh toán trả về địa chỉ không hợp lệ.');
      }
      return { checkoutUrl: data.checkoutUrl, providerRef: String(data.paymentLinkId ?? '') || `PAYOS-${request.orderCode}` };
    },

    verifyWebhook(body) {
      const data = body?.data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || typeof body.signature !== 'string') throw new Error('malformed webhook');
      if (!sameHex(dataSignature(data, checksumKey), body.signature)) throw new Error('bad signature');
      // Signed by PayOS, but only a successful payment is credited (code "00").
      if (body.success === false || String(data.code ?? body.code) !== '00') return null;
      const orderCode = Number(data.orderCode) - offset;
      const amount = Number(data.amount);
      if (!Number.isSafeInteger(amount)) throw new Error('malformed webhook data');
      // Not one of our codes (PayOS's test payment when the address is registered, or another offset): nothing to credit.
      if (!Number.isSafeInteger(orderCode) || orderCode <= 0) return null;
      return { orderCode, amountVnd: amount, reference: String(data.reference ?? data.paymentLinkId ?? '').slice(0, 120) || `PAYOS-${data.orderCode}` };
    },

    /** Registers the address PayOS sends payments to (it sends a test payment there first). */
    async confirmWebhook(webhookUrl) {
      return call('/confirm-webhook', { webhookUrl });
    },
  };
}

module.exports = { createPayosProvider, requestSignature, dataSignature };
