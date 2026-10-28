import type { SiteLang } from '../../services/site-lang.service';

/** The words of the sign-in / account dialog, in both languages. */
export interface AccountText {
  titleAccount: string;
  titleRegister: string;
  titleLogin: string;
  close: string;
  noteSaved: string;
  verifyNeeded: string;
  resend: string;
  planFree: string;
  planUntil: (day: string) => string;
  aiToday: (premiumLeft: number | null, free: number, story: number, bought: number) => string;
  manage: string;
  adminReports: string;
  upgrade: string;
  displayName: string;
  saveName: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  otherDevices: string;
  exportTitle: string;
  exportHint: string;
  confirmPassword: string;
  exportBusy: string;
  exportButton: string;
  deleteTitle: string;
  deleteHint: string;
  deleteButton: string;
  signOut: string;
  noteRegister: string;
  noteLogin: string;
  nameOptional: string;
  email: string;
  password: string;
  passwordMin: string;
  termsPre: string;
  termsAnd: string;
  termsPost: string;
  termsLink: string;
  privacyLink: string;
  working: string;
  create: string;
  signIn: string;
  forgot: string;
  haveAccount: string;
  noAccount: string;
  doneRegistered: (email: string) => string;
  doneResent: string;
  doneName: string;
  donePassword: string;
  doneExport: string;
  confirmDelete: string;
}

export const ACCOUNT_TEXT: Record<SiteLang, AccountText> = {
  vi: {
    titleAccount: 'Tài khoản',
    titleRegister: 'Tạo tài khoản',
    titleLogin: 'Đăng nhập',
    close: 'Đóng',
    noteSaved: 'Báo cáo bạn lưu trong công cụ Mở gì ở đâu được giữ trong tài khoản này và mở được trên mọi thiết bị.',
    verifyNeeded: 'Email chưa được xác minh. Hãy mở liên kết trong email chúng tôi đã gửi.',
    resend: 'Gửi lại email xác minh',
    planFree: 'Gói miễn phí',
    planUntil: (day) => `đến ${day}`,
    aiToday: (premiumLeft, free, story, bought) => `Lượt AI chuyên sâu hôm nay: ${premiumLeft === null ? '' : `${premiumLeft} Premium + `}${free} miễn phí · Hà Nội xưa và nay: ${story} miễn phí · đã mua: ${bought}`,
    manage: 'Quản lý gói',
    adminReports: 'Quản trị: báo sai số liệu',
    upgrade: 'Nâng cấp Premium',
    displayName: 'Tên hiển thị',
    saveName: 'Lưu tên',
    changePassword: 'Đổi mật khẩu',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới (ít nhất 8 ký tự)',
    otherDevices: 'Các thiết bị khác đang đăng nhập sẽ bị đăng xuất.',
    exportTitle: 'Tải về dữ liệu của tôi',
    exportHint: 'Một tệp JSON gồm thông tin tài khoản, báo cáo và kế hoạch đã lưu, đơn hàng và các báo cáo sai số liệu bạn đã gửi. Không gồm mật khẩu.',
    confirmPassword: 'Nhập mật khẩu để xác nhận',
    exportBusy: 'Đang chuẩn bị…',
    exportButton: 'Tải tệp dữ liệu',
    deleteTitle: 'Xoá tài khoản',
    deleteHint: 'Xoá vĩnh viễn tài khoản và mọi báo cáo đã lưu. Không thể khôi phục.',
    deleteButton: 'Xoá tài khoản',
    signOut: 'Đăng xuất',
    noteRegister: 'Tạo tài khoản để giữ báo cáo đã lưu trên mọi thiết bị. Báo cáo đang có trong trình duyệt này sẽ được chuyển vào tài khoản.',
    noteLogin: 'Đăng nhập để mở các báo cáo đã lưu trên mọi thiết bị.',
    nameOptional: 'Tên hiển thị (không bắt buộc)',
    email: 'Email',
    password: 'Mật khẩu',
    passwordMin: ' (ít nhất 8 ký tự)',
    termsPre: 'Tôi đồng ý với ',
    termsAnd: ' và ',
    termsPost: '.',
    termsLink: 'Điều khoản sử dụng',
    privacyLink: 'Chính sách quyền riêng tư',
    working: 'Đang xử lý…',
    create: 'Tạo tài khoản',
    signIn: 'Đăng nhập',
    forgot: 'Quên mật khẩu?',
    haveAccount: 'Đã có tài khoản?',
    noAccount: 'Chưa có tài khoản?',
    doneRegistered: (email) => `Đã tạo tài khoản. Chúng tôi vừa gửi email xác minh tới ${email}. Nếu chưa thấy thư, hãy kiểm tra cả mục Thư rác (Spam) và chọn "Không phải thư rác".`,
    doneResent: 'Đã gửi email xác minh. Hãy kiểm tra hộp thư, và cả mục Thư rác (Spam) nếu chưa thấy.',
    doneName: 'Đã lưu tên.',
    donePassword: 'Đã đổi mật khẩu.',
    doneExport: 'Đã tải tệp dữ liệu về máy bạn.',
    confirmDelete: 'Xoá vĩnh viễn tài khoản và mọi báo cáo đã lưu?',
  },
  en: {
    titleAccount: 'Account',
    titleRegister: 'Create an account',
    titleLogin: 'Sign in',
    close: 'Close',
    noteSaved: 'The reports you save in the Business Opportunity Map are kept in this account and open on any device.',
    verifyNeeded: 'Your email is not verified yet. Open the link in the email we sent.',
    resend: 'Send the verification email again',
    planFree: 'Free plan',
    planUntil: (day) => `until ${day}`,
    aiToday: (premiumLeft, free, story, bought) => `In-depth AI questions today: ${premiumLeft === null ? '' : `${premiumLeft} Premium + `}${free} free · Hanoi Time Machine: ${story} free · bought: ${bought}`,
    manage: 'Manage plan',
    adminReports: 'Admin: data error reports',
    upgrade: 'Upgrade to Premium',
    displayName: 'Display name',
    saveName: 'Save name',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password (at least 8 characters)',
    otherDevices: 'Other devices that are signed in will be signed out.',
    exportTitle: 'Download my data',
    exportHint: 'One JSON file with your account details, the reports and plans you saved, your orders and the data-error reports you sent. It does not include your password.',
    confirmPassword: 'Enter your password to confirm',
    exportBusy: 'Preparing…',
    exportButton: 'Download the file',
    deleteTitle: 'Delete my account',
    deleteHint: 'Permanently deletes the account and every saved report. This cannot be undone.',
    deleteButton: 'Delete the account',
    signOut: 'Sign out',
    noteRegister: 'Create an account to keep your saved reports on every device. The reports in this browser will be moved into the account.',
    noteLogin: 'Sign in to open your saved reports on any device.',
    nameOptional: 'Display name (optional)',
    email: 'Email',
    password: 'Password',
    passwordMin: ' (at least 8 characters)',
    termsPre: 'I agree to the ',
    termsAnd: ' and the ',
    termsPost: '.',
    termsLink: 'Terms of Use',
    privacyLink: 'Privacy Policy',
    working: 'Working…',
    create: 'Create account',
    signIn: 'Sign in',
    forgot: 'Forgot your password?',
    haveAccount: 'Already have an account?',
    noAccount: 'No account yet?',
    doneRegistered: (email) => `Account created. We have just sent a verification email to ${email}. If you do not see it, check your Spam folder too and choose "Not spam".`,
    doneResent: 'Verification email sent. Check your inbox, and the Spam folder if you do not see it.',
    doneName: 'Name saved.',
    donePassword: 'Password changed.',
    doneExport: 'The data file was downloaded to your device.',
    confirmDelete: 'Permanently delete the account and every saved report?',
  },
};

/** What the server's error codes mean to a reader of English (the server's own messages are in Vietnamese). */
export const ERROR_EN: Record<string, string> = {
  invalid: 'Something you entered is not valid. Please check it and try again.',
  bad_credentials: 'The email or password is not correct.',
  email_taken: 'This email is already registered.',
  invalid_token: 'The link is not valid or has expired.',
  rate_limited: 'Too many attempts. Please wait a while and try again.',
  unauthenticated: 'Please sign in first.',
  email_not_verified: 'Please verify your email before buying: open the link in the email we sent, or send it again from the Account section.',
  no_credits: 'You have no report credits left.',
  premium_required: 'This is a Premium feature.',
  plan_limit: 'You have reached the limit of your plan.',
  accounts_disabled: 'Accounts are not turned on on this server.',
  billing_disabled: 'Payments are not turned on on this server.',
  payment_provider_error: 'The payment gateway could not create the order. Please try again later.',
  payment_provider_unavailable: 'The payment gateway is not responding. Please try again in a few minutes.',
  bad_return_url: 'The return address is not valid.',
  bad_origin: 'The request did not come from this site.',
  bad_webhook: 'The payment notification was not valid.',
  mail_off: 'Email is not set up on this server.',
  too_soon: 'Please wait a minute before asking again.',
  unknown_ward: 'This ward is not on the map.',
  not_scored: 'This ward has no score yet.',
  not_found: 'Not found.',
  forbidden: 'You are not allowed to do this.',
};
