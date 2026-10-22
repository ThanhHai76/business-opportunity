'use strict';
/**
 * Purchases — mounted by server.js at /api/billing. Buyers are signed-in accounts (src/accounts).
 *
 *   GET  /products                  { enabled, provider, products, aiLimits }   (public)
 *   GET  /me                        { credits, ai, orders }  report credits, AI allowances + Premium, 10 latest orders
 *   POST /checkout                  { product, returnUrl, cancelUrl? } → 201 { order, checkoutUrl }
 *   GET  /orders/:id                { order }                         (the page polls it until paid)
 *   POST /orders/:id/cancel         { order }
 *   POST /webhook/:provider         payment notification from the provider (signed, no session)
 *   GET  /mock/checkout/:orderCode  BILLING_PROVIDER=mock only: a pretend checkout page; its buttons POST to
 *   POST /mock/checkout/:orderCode/pay · /cancel
 *
 * BILLING_PROVIDER: mock (default outside production, refused in production) | off (default in production).
 * A real provider (PayOS) implements the interface described in mock-provider.js and is selected in createProvider().
 *
 * Credits are added only by a verified webhook — never by the browser coming back to returnUrl.
 */
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { AccountError, badRequest, forbidden, notFound } = require('../accounts/errors');
const { PRODUCTS, STORY_TOOLS, grantsOf, productList } = require('./products');
const { NO_METER, statusView, dayStartVn } = require('./ai-meter');
const { createMockProvider } = require('./mock-provider');
const { wrap, signedInWith, finishRouter, escapeHtml, UUID } = require('./common');

const ORDER_MINUTES = 30;
const ORDERS_SHOWN = 10;

const billingOff = () => new AccountError(503, 'billing_disabled', 'Thanh toán chưa được bật trên máy chủ này.');

function createProvider(name, options) {
  if (name === 'off') return null;
  if (name === 'mock') {
    if (process.env.NODE_ENV === 'production') throw new Error('BILLING_PROVIDER=mock is for development only');
    return createMockProvider({ secret: options.webhookSecret });
  }
  throw new Error(`BILLING_PROVIDER=${name} is not supported yet (mock, off)`);
}

const CheckoutSchema = z.strictObject({
  product: z.enum(Object.keys(PRODUCTS)),
  returnUrl: z.string().max(2000),
  cancelUrl: z.string().max(2000).optional(),
});

/** A pending order past its deadline shows as expired (it is still credited if the money arrives later). */
const orderView = (o, now = new Date()) => ({
  id: o.id,
  orderCode: o.orderCode,
  product: o.product,
  credits: o.credits,
  // What the order adds when paid (orders made before AI packs and Premium only added report credits).
  grants: o.grants ?? { reportCredits: o.credits, aiCredits: 0, premiumDays: 0 },
  amountVnd: o.amountVnd,
  status: o.status === 'pending' && new Date(o.expiresAt) <= now ? 'expired' : o.status,
  createdAt: o.createdAt,
  expiresAt: o.expiresAt,
  paidAt: o.paidAt,
});

/**
 * @param options {
 *   accounts: the accounts module (users, sessions, store);
 *   isAllowedOrigin: (origin) => boolean   (return URLs may only point at our own pages);
 *   meter?: the AI meter (src/billing/ai-meter.js), for the AI allowances shown by /me;
 *   provider?: a provider object (tests), or built from BILLING_PROVIDER;
 *   webhookSecret?: the mock provider's signing secret;
 *   rateLimits?: { checkout } per hour per IP
 * }
 */
function createBilling(options) {
  const { accounts } = options;
  const meter = options.meter ?? NO_METER;
  const premium = options.premium ?? { enabled: false };
  const isAllowedOrigin = options.isAllowedOrigin ?? (() => false);
  const provider =
    options.provider !== undefined
      ? options.provider
      : // `||`: an empty line in .env (BILLING_PROVIDER=) means "the default", like a missing one.
        createProvider(process.env.BILLING_PROVIDER || (process.env.NODE_ENV === 'production' ? 'off' : 'mock'), {
          webhookSecret: options.webhookSecret || process.env.BILLING_WEBHOOK_SECRET || undefined,
        });
  const enabled = () => Boolean(provider && accounts.enabled);
  /** AI allowances and Premium of an account (the meter's view, whether or not metering is on). */
  const createStatus = async (userId) => {
    if (meter.enabled) return meter.status(userId);
    const now = new Date();
    return statusView(await accounts.store.aiStatus(userId, { now, dayStart: dayStartVn(now), storyTools: STORY_TOOLS }), meter.limits, now);
  };
  const store = () => accounts.store;
  const signedIn = signedInWith(accounts);

  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use(express.urlencoded({ extended: false, limit: '8kb' })); // the mock checkout page's forms
  router.use(accounts.sameOriginOnly);
  router.use((req, res, next) => (req.path === '/products' || enabled() ? next() : next(billingOff())));

  /** Only our own pages: same host as the API, or an origin the CORS rule allows. */
  const safeUrl = (value, req) => {
    if (typeof value !== 'string') return null;
    let url;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.host === req.get('host') || isAllowedOrigin(url.origin) ? url.toString() : null;
  };

  /** Verifies a provider notification and credits the order (once). */
  async function recordPayment(providerName, body) {
    if (providerName !== provider.name) throw notFound();
    let paid;
    try {
      paid = provider.verifyWebhook(body);
    } catch (error) {
      console.warn(`[billing] rejected ${providerName} webhook: ${error.message}`);
      throw badRequest('Thông báo thanh toán không hợp lệ.', 'bad_webhook');
    }
    const result = await store().markOrderPaid(paid.orderCode, { amountVnd: paid.amountVnd, providerRef: paid.reference, paidAt: new Date() });
    if (!result.order) console.warn(`[billing] payment for unknown order ${paid.orderCode} (${paid.amountVnd} VND, ${paid.reference})`);
    else if (result.mismatch) console.warn(`[billing] order ${paid.orderCode}: paid ${paid.amountVnd} VND, expected ${result.order.amountVnd} — not credited, check by hand`);
    return result;
  }

  const checkoutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.rateLimits?.checkout ?? 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AccountError(429, 'rate_limited', 'Tạo đơn quá nhiều lần — vui lòng đợi một lúc.')),
  });

  router.get('/products', (req, res) => {
    res.json({ enabled: enabled(), provider: provider?.name ?? null, products: productList(), aiLimits: meter.limits, aiMetering: meter.enabled, premiumGating: premium.enabled });
  });

  router.get(
    '/me',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const [credits, orders, ai] = await Promise.all([
        store().creditBalance(req.user.id),
        store().listOrders(req.user.id, ORDERS_SHOWN),
        accounts.store.aiStatus ? createStatus(req.user.id) : null,
      ]);
      res.json({ credits, ai, orders: orders.map((o) => orderView(o)) });
    }),
  );

  router.post(
    '/checkout',
    checkoutLimiter,
    signedIn(async (req, res) => {
      const parsed = CheckoutSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw badRequest('Gói không hợp lệ.');
      // With real email, buying needs an address that is verified: receipts and account recovery depend on it.
      if (accounts.requireVerifiedEmail && !req.user.emailVerifiedAt) {
        throw forbidden('Hãy xác minh email trước khi mua: mở email chúng tôi đã gửi, hoặc gửi lại email xác minh trong mục Tài khoản.', 'email_not_verified');
      }
      const body = parsed.data;
      const returnUrl = safeUrl(body.returnUrl, req);
      const cancelUrl = body.cancelUrl === undefined ? returnUrl : safeUrl(body.cancelUrl, req);
      if (!returnUrl || !cancelUrl) throw badRequest('Địa chỉ quay lại không hợp lệ.', 'bad_return_url');
      const product = PRODUCTS[body.product];
      const grants = grantsOf(product);
      const order = await store().createOrder({
        userId: req.user.id,
        product: body.product,
        credits: grants.reportCredits,
        grants,
        amountVnd: product.amountVnd,
        provider: provider.name,
        expiresAt: new Date(Date.now() + ORDER_MINUTES * 60_000),
      });
      const payment = await provider.createPayment({
        order,
        // Shown in the buyer's bank app; providers keep it short.
        description: `HCV ${order.orderCode}`,
        apiBase: `${req.protocol}://${req.get('host')}`,
        returnUrl,
        cancelUrl,
      });
      const saved = (await store().setOrderProviderRef(order.id, payment.providerRef)) ?? order;
      res.status(201).json({ order: orderView(saved), checkoutUrl: payment.checkoutUrl });
    }),
  );

  router.get(
    '/orders/:id',
    signedIn(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const order = UUID.test(req.params.id) ? await store().getOrder(req.params.id) : null;
      if (!order || order.userId !== req.user.id) throw notFound('Không tìm thấy đơn hàng.');
      res.json({ order: orderView(order) });
    }),
  );

  router.post(
    '/orders/:id/cancel',
    signedIn(async (req, res) => {
      const order = UUID.test(req.params.id) ? await store().cancelOrder(req.user.id, req.params.id) : null;
      if (!order) throw notFound('Không tìm thấy đơn hàng.');
      res.json({ order: orderView(order) });
    }),
  );

  router.post(
    '/webhook/:provider',
    wrap(async (req, res) => {
      const result = await recordPayment(req.params.provider, req.body);
      res.json({ ok: Boolean(result.order) && !result.mismatch, credited: result.credited });
    }),
  );

  // ---------------------------------------------------------------- pretend checkout (mock provider only)
  if (provider?.name === 'mock') {
    const mockOrder = async (req) => {
      const code = Number(req.params.orderCode);
      const order = Number.isSafeInteger(code) ? await store().getOrderByCode(code) : null;
      if (!order) throw notFound('Không tìm thấy đơn hàng.');
      return order;
    };

    router.get(
      '/mock/checkout/:orderCode',
      wrap(async (req, res) => {
        const order = orderView(await mockOrder(req));
        const returnUrl = safeUrl(req.query.returnUrl, req) ?? '';
        const cancelUrl = safeUrl(req.query.cancelUrl, req) ?? returnUrl;
        res.setHeader('Cache-Control', 'no-store');
        res.type('html').send(mockCheckoutPage(order, returnUrl, cancelUrl));
      }),
    );

    router.post(
      '/mock/checkout/:orderCode/pay',
      wrap(async (req, res) => {
        const order = await mockOrder(req);
        await recordPayment('mock', provider.paidWebhook(order));
        const back = safeUrl(req.body?.returnUrl, req);
        if (back) return res.redirect(303, back);
        res.type('html').send('<p>Đã thanh toán (giả lập). Bạn có thể đóng tab này.</p>');
      }),
    );

    router.post(
      '/mock/checkout/:orderCode/cancel',
      wrap(async (req, res) => {
        const order = await mockOrder(req);
        if (order.userId) await store().cancelOrder(order.userId, order.id);
        const back = safeUrl(req.body?.cancelUrl, req);
        if (back) return res.redirect(303, back);
        res.type('html').send('<p>Đã huỷ (giả lập). Bạn có thể đóng tab này.</p>');
      }),
    );
  }

  finishRouter(router, 'billing');
  return {
    router,
    provider,
    get enabled() {
      return enabled();
    },
  };
}

function mockCheckoutPage(order, returnUrl, cancelUrl) {
  const product = PRODUCTS[order.product];
  const vnd = new Intl.NumberFormat('vi-VN').format(order.amountVnd);
  const open = order.status === 'pending';
  const hidden = `<input type="hidden" name="returnUrl" value="${escapeHtml(returnUrl)}"><input type="hidden" name="cancelUrl" value="${escapeHtml(cancelUrl)}">`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thanh toán thử · Hanoi Century Vista</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;background:#f4f1ea;color:#1d1b16;margin:0;padding:24px 16px}
main{max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.warn{background:#fff3cd;border:1px solid #e6c65c;border-radius:8px;padding:10px 12px;font-size:14px}
.amount{font-size:32px;font-weight:700;margin:8px 0}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:14px}dt{color:#6b665c}
button{font:inherit;padding:12px 16px;border-radius:8px;border:0;cursor:pointer;width:100%;margin-top:10px}
.pay{background:#1f6f4a;color:#fff}.cancel{background:#ece8df;color:#1d1b16}
</style></head><body><main>
<p class="warn"><strong>Cổng thanh toán GIẢ</strong> để thử luồng mua hàng — không có tiền thật. Khi kết nối PayOS, trang này được thay bằng trang mã QR của PayOS.</p>
<h1 style="font-size:20px;margin:16px 0 0">${escapeHtml(product?.name.vi ?? order.product)}</h1>
<div class="amount">${vnd} đ</div>
<dl><dt>Mã đơn</dt><dd>${order.orderCode}</dd><dt>Nội dung CK</dt><dd>HCV ${order.orderCode}</dd><dt>Trạng thái</dt><dd>${escapeHtml(order.status)}</dd></dl>
${
  open || order.status === 'expired'
    ? `<form method="post" action="${order.orderCode}/pay">${hidden}<button class="pay" type="submit">Giả lập: đã chuyển khoản thành công</button></form>
<form method="post" action="${order.orderCode}/cancel">${hidden}<button class="cancel" type="submit">Huỷ thanh toán</button></form>`
    : `<p>Đơn này đã ${order.status === 'paid' ? 'được thanh toán' : 'bị huỷ'}.</p>`
}
</main></body></html>`;
}

module.exports = { createBilling, orderView };
