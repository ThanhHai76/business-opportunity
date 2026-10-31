import { LEGAL, isPlaceholder, legalIncomplete } from './legal.config';
import { legalDoc } from './legal-content';

describe('legal pages', () => {
  it('has terms, privacy and refund text with sections', () => {
    for (const kind of ['terms', 'privacy', 'refund'] as const) {
      const doc = legalDoc(kind);
      expect(doc.title.length).toBeGreaterThan(3);
      expect(doc.sections.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('tells people what is shared with the AI, payment and email providers', () => {
    const privacy = JSON.stringify(legalDoc('privacy'));
    expect(privacy).toContain('Anthropic');
    expect(privacy).toContain('cổng thanh toán');
    expect(privacy).toContain('PayOS');
    expect(privacy).toContain('Cloudflare');
    expect(privacy).toContain('Luật Bảo vệ dữ liệu cá nhân');
  });

  it('flags operator details that are still placeholders', () => {
    expect(isPlaceholder('[điền vào đây]')).toBeTrue();
    expect(isPlaceholder('Công ty A')).toBeFalse();
    expect(legalIncomplete()).toBe([LEGAL.operatorName, LEGAL.address, LEGAL.contactEmail].some(isPlaceholder));
  });
});
