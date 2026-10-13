'use strict';
/** HTTP errors of the accounts API: { status, code, message } (message in Vietnamese, the page shows its own text per code). */
class AccountError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message, code = 'invalid') => new AccountError(400, code, message);
const unauthorized = (message = 'Bạn cần đăng nhập.', code = 'unauthenticated') => new AccountError(401, code, message);
const forbidden = (message, code = 'forbidden') => new AccountError(403, code, message);
const notFound = (message = 'Không tìm thấy.') => new AccountError(404, 'not_found', message);
const conflict = (message = 'Email này đã được đăng ký.') => new AccountError(409, 'email_taken', message);
const disabled = () => new AccountError(503, 'accounts_disabled', 'Tài khoản chưa được bật trên máy chủ này (chưa cấu hình DATABASE_URL).');

module.exports = { AccountError, badRequest, unauthorized, forbidden, notFound, conflict, disabled };
