/** Lower-cases and strips Vietnamese diacritics so "Đông Anh", "dong anh" and "ĐÔNG-ANH" compare equal. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
