'use strict';
/**
 * Who runs the site: the accounts whose email is in ADMIN_EMAILS (comma separated, any case) and has been verified.
 * An address that was never confirmed does not count: anyone could have typed it. Empty list: nobody.
 */
const { AccountError } = require('./errors');

function adminEmailsFrom(value) {
  return new Set(String(value ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

function createAdminGate(accounts, emails = process.env.ADMIN_EMAILS) {
  const admins = adminEmailsFrom(emails);
  const isAdmin = (user) => Boolean(user?.emailVerifiedAt) && admins.has(String(user.email).toLowerCase());
  const userOf = (req, res) => (accounts.enabled ? accounts.userOf(req, res) : null);

  return {
    isAdmin,
    /** Whether the signed-in account is an administrator (false when nobody is signed in). */
    async check(req, res) {
      return isAdmin(await userOf(req, res));
    },
    /** Throws 401 when nobody is signed in and 403 for anyone who is not an administrator. */
    async require(req, res) {
      const user = await userOf(req, res);
      if (!user) throw new AccountError(401, 'not_signed_in', 'Hãy đăng nhập.');
      if (!isAdmin(user)) throw new AccountError(403, 'forbidden', 'Tài khoản này không có quyền xem trang quản trị.');
    },
  };
}

module.exports = { createAdminGate, adminEmailsFrom };
