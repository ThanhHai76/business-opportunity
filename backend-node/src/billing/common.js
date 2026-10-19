'use strict';
/** Shared by the billing and paid-report routers: same session, CSRF check and error format as /api/account. */
const { AccountError, unauthorized } = require('../accounts/errors');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

/** A handler for signed-in users only (401 otherwise); req.user is the user. */
const signedInWith = (accounts) => (handler) =>
  wrap(async (req, res) => {
    req.user = await accounts.userOf(req, res);
    if (!req.user) throw unauthorized();
    await handler(req, res);
  });

/** 404 for unknown paths, then { statusCode, code, message } for every error. */
function finishRouter(router, tag) {
  router.use((req, res) => res.status(404).json({ statusCode: 404, code: 'not_found', message: 'Không tìm thấy đường dẫn.' }));
  // eslint-disable-next-line no-unused-vars
  router.use((error, req, res, next) => {
    if (error instanceof AccountError) return res.status(error.status).json({ statusCode: error.status, code: error.code, message: error.message });
    if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
      return res.status(400).json({ statusCode: 400, code: 'invalid', message: 'Dữ liệu gửi lên không hợp lệ.' });
    }
    console.error(`[${tag}]`, error);
    res.status(500).json({ statusCode: 500, code: 'server_error', message: 'Lỗi máy chủ, vui lòng thử lại.' });
  });
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = { wrap, signedInWith, finishRouter, escapeHtml, UUID };
