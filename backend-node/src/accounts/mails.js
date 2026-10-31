'use strict';
/** The messages the accounts module sends. Plain text first (every client shows it), with a small HTML twin. */
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The host of the site the link points to, so the mail can say where it comes from. */
const siteOf = (link) => {
  try {
    return new URL(link).host;
  } catch {
    return '';
  }
};

function layout(greeting, lines, link, linkLabel, footer) {
  const site = siteOf(link);
  // Why the mail was sent, in plain words: an automatic mail that says where it comes from looks less like unwanted mail.
  const reason = site ? `Bạn nhận email này vì địa chỉ này được dùng tại ${site}.` : '';
  const text = [greeting, '', ...lines, '', `${linkLabel}: ${link}`, '', footer, ...(reason ? [reason] : []), '— Hanoi Century Vista'].join('\n');
  const html =
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(lines[0])}</div>` +
    `<p>${escapeHtml(greeting)}</p>` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
    `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#b8862b;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(linkLabel)}</a></p>` +
    `<p style="color:#666;font-size:13px">Nếu nút không bấm được, hãy dán liên kết này vào trình duyệt:<br>${escapeHtml(link)}</p>` +
    `<p style="color:#666;font-size:13px">${escapeHtml(footer)}</p>` +
    (reason ? `<p style="color:#666;font-size:13px">${escapeHtml(reason)}</p>` : '') +
    '<p style="color:#666;font-size:13px">— Hanoi Century Vista</p>';
  return { text, html };
}

const greet = (name) => (name ? `Chào ${name},` : 'Chào bạn,');

function verifyEmailMail({ link, name, hours }) {
  return {
    subject: 'Xác minh email của bạn — Hanoi Century Vista',
    ...layout(
      greet(name),
      ['Cảm ơn bạn đã tạo tài khoản. Hãy xác minh địa chỉ email này để bảo vệ tài khoản và nhận được thông báo khi cần.', `Liên kết có hiệu lực trong ${hours} giờ.`],
      link,
      'Xác minh email',
      'Nếu bạn không tạo tài khoản, hãy bỏ qua email này.',
    ),
  };
}

function resetPasswordMail({ link, name, minutes }) {
  return {
    subject: 'Đặt lại mật khẩu — Hanoi Century Vista',
    ...layout(
      greet(name),
      ['Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.', `Liên kết dưới đây dùng được một lần và có hiệu lực trong ${minutes} phút.`],
      link,
      'Đặt lại mật khẩu',
      'Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.',
    ),
  };
}

const vnd = (n) => `${Number(n).toLocaleString('vi-VN')}đ`;

/** What an order added to the account, in words ("3 báo cáo khả thi, 30 lượt hỏi AI chuyên sâu, 30 ngày Premium"). */
function grantsText(g = {}) {
  const parts = [];
  if (g.reportCredits > 0) parts.push(`${g.reportCredits} lượt báo cáo khả thi`);
  if (g.aiCredits > 0) parts.push(`${g.aiCredits} lượt hỏi AI chuyên sâu`);
  if (g.premiumDays > 0) parts.push(`${g.premiumDays} ngày Premium`);
  return parts.join(', ');
}

/** Sent once, when a payment has been received and the order credited. */
function paymentReceivedMail({ name, productName, amountVnd, orderCode, paidAt, grants, accountLink, refundLink }) {
  const when = new Date(paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const added = grantsText(grants);
  return {
    subject: `Đã nhận thanh toán ${vnd(amountVnd)} — Hanoi Century Vista`,
    ...layout(
      greet(name),
      [
        `Chúng tôi đã nhận thanh toán ${vnd(amountVnd)} cho "${productName}". Cảm ơn bạn.`,
        `Mã đơn: ${orderCode} · Thời gian: ${when} (giờ Việt Nam).`,
        ...(added ? [`Đã cộng vào tài khoản: ${added}.`] : []),
        `Cần hỗ trợ hoặc hoàn tiền? Xem chính sách tại ${refundLink}.`,
      ],
      accountLink,
      'Xem tài khoản của tôi',
      'Đây là email tự động xác nhận thanh toán. Nếu bạn không thực hiện giao dịch này, hãy liên hệ với chúng tôi ngay.',
    ),
  };
}

module.exports = { verifyEmailMail, resetPasswordMail, paymentReceivedMail };
