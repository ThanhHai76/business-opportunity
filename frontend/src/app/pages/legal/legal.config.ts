/**
 * Who runs the service. The legal pages (Terms, Privacy, Refunds) read these values.
 * FILL THESE IN before the site takes real payments: the pages show a visible warning while a value is still a placeholder.
 */
export const LEGAL = {
  /** Registered name of the person or company that operates the service. */
  operatorName: '[Tên cá nhân / doanh nghiệp vận hành]',
  /** Tax code or business registration number, if any. */
  registrationNo: '[Mã số thuế / số đăng ký kinh doanh]',
  address: '[Địa chỉ liên hệ]',
  /** Email that receives questions, refund requests and data-subject requests. */
  contactEmail: '[email-lien-he@ten-mien-cua-ban]',
  phone: '',
  /** Date the current text took effect (ISO). */
  effectiveDate: '2026-10-16',
  /** Days a customer has to ask for a refund after a payment that did not deliver what was bought. */
  refundDays: 7,
};

export const isPlaceholder = (value: string): boolean => /^\[.*\]$/.test(value.trim());

/** True while any required operator detail is still a placeholder. */
export const legalIncomplete = (): boolean => [LEGAL.operatorName, LEGAL.address, LEGAL.contactEmail].some(isPlaceholder);
