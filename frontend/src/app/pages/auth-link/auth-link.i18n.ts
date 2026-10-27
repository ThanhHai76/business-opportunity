import type { SiteLang } from '../../services/site-lang.service';

/** The words of the pages reached from an email (forgot password, reset, verify), in both languages. */
export interface AuthText {
  forgotTitle: string;
  forgotSent: string;
  mailOff: string;
  forgotAsk: string;
  email: string;
  sending: string;
  sendLink: string;
  resetTitle: string;
  resetDone: string;
  signIn: string;
  badLink: string;
  newLink: string;
  newPassword: string;
  saving: string;
  changePassword: string;
  verifyTitle: string;
  verified: string;
  verifying: string;
  verifyHint: string;
  badLinkExpired: string;
  back: string;
}

export const AUTH_TEXT: Record<SiteLang, AuthText> = {
  vi: {
    forgotTitle: 'Quên mật khẩu',
    forgotSent: 'Nếu email này có tài khoản, chúng tôi vừa gửi một liên kết đặt lại mật khẩu (hiệu lực 1 giờ). Hãy kiểm tra hộp thư, kể cả thư rác.',
    mailOff: 'Máy chủ này chưa bật gửi email, nên chưa thể đặt lại mật khẩu tự động.',
    forgotAsk: 'Nhập email đăng ký, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.',
    email: 'Email',
    sending: 'Đang gửi…',
    sendLink: 'Gửi liên kết',
    resetTitle: 'Đặt mật khẩu mới',
    resetDone: 'Đã đổi mật khẩu. Bạn đã được đăng xuất khỏi mọi thiết bị.',
    signIn: 'Đăng nhập',
    badLink: 'Liên kết không hợp lệ.',
    newLink: 'Yêu cầu liên kết mới',
    newPassword: 'Mật khẩu mới (ít nhất 8 ký tự)',
    saving: 'Đang lưu…',
    changePassword: 'Đổi mật khẩu',
    verifyTitle: 'Xác minh email',
    verified: 'Email của bạn đã được xác minh. Cảm ơn bạn!',
    verifying: 'Đang xác minh…',
    verifyHint: 'Đăng nhập rồi chọn “Gửi lại email xác minh” trong mục Tài khoản.',
    badLinkExpired: 'Liên kết không hợp lệ hoặc đã hết hạn.',
    back: '← Về trang chủ',
  },
  en: {
    forgotTitle: 'Forgot your password',
    forgotSent: 'If this email has an account, we have just sent a link to reset the password (valid for 1 hour). Check your inbox, and the spam folder too.',
    mailOff: 'This server does not send email yet, so the password cannot be reset automatically.',
    forgotAsk: 'Enter the email you signed up with and we will send a link to set a new password.',
    email: 'Email',
    sending: 'Sending…',
    sendLink: 'Send the link',
    resetTitle: 'Set a new password',
    resetDone: 'The password was changed. You have been signed out of every device.',
    signIn: 'Sign in',
    badLink: 'The link is not valid.',
    newLink: 'Ask for a new link',
    newPassword: 'New password (at least 8 characters)',
    saving: 'Saving…',
    changePassword: 'Change password',
    verifyTitle: 'Verify your email',
    verified: 'Your email is verified. Thank you!',
    verifying: 'Verifying…',
    verifyHint: 'Sign in, then choose "Send the verification email again" in the Account section.',
    badLinkExpired: 'The link is not valid or has expired.',
    back: '← Back to the home page',
  },
};
