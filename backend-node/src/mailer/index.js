'use strict';
/**
 * Outgoing email: the links that verify an address and reset a password. MAIL_PROVIDER:
 *   smtp    — a real SMTP server. SMTP_URL=smtps://user:password@smtp.example.com:465, MAIL_FROM="Hanoi Century Vista <no-reply@your-domain>".
 *             Needs the `nodemailer` package (npm install).
 *   console — prints each message, with its link, in the server log: to try the flows without a mail server.
 *   off     — nothing is sent: the features that need email are switched off.
 * Default: smtp when SMTP_URL is set; otherwise console outside production and off in production.
 *
 * A mailer is { kind, enabled, real, send({ to, subject, text, html }) }; `send` rejects when the message was not sent.
 */
function createMailer(options = {}) {
  const env = options.env ?? process.env;
  const kind = options.provider ?? (env.MAIL_PROVIDER || (env.SMTP_URL ? 'smtp' : env.NODE_ENV === 'production' ? 'off' : 'console'));
  const from = options.from ?? (env.MAIL_FROM || 'Hanoi Century Vista <no-reply@localhost>');
  const log = options.log !== false;

  if (kind === 'off') return { kind, enabled: false, real: false, async send() { throw new Error('Mail is off (MAIL_PROVIDER=off).'); } };

  if (kind === 'console') {
    return {
      kind,
      enabled: true,
      real: false,
      async send({ to, subject, text }) {
        if (log) console.log(`[mail] to ${to}\n[mail] subject: ${subject}\n${text.split('\n').map((l) => `[mail] ${l}`).join('\n')}`);
      },
    };
  }

  if (kind === 'smtp') {
    const url = options.smtpUrl ?? env.SMTP_URL;
    if (!url) throw new Error('MAIL_PROVIDER=smtp needs SMTP_URL.');
    let transport;
    return {
      kind,
      enabled: true,
      real: true,
      async send({ to, subject, text, html }) {
        // Loaded on first use so the server starts without the package when SMTP is not used.
        transport ??= require('nodemailer').createTransport(url);
        await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
      },
    };
  }

  throw new Error(`Unknown MAIL_PROVIDER "${kind}" (smtp, console or off).`);
}

module.exports = { createMailer };
