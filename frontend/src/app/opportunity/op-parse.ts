import { ParsedIdea } from './op.models';

/**
 * Reads a business idea in the browser, the same way as the backend's POST /parse
 * (backend-node/src/opportunity/ai.js → parseIdea). Used when the backend is older and has no /parse route.
 */
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Words (folded, both languages) that name each business type — keep in step with TYPE_WORDS in ai.js. */
const TYPE_WORDS: Record<string, string[]> = {
  cafe: ['ca phe', 'cafe', 'coffee', 'tra sua'],
  fnb: ['nha hang', 'quan an', 'an uong', 'restaurant', 'food', 'f&b', 'fnb'],
  gym: ['gym', 'fitness', 'yoga', 'the hinh'],
  education: ['mam non', 'giao duc', 'ngoai ngu', 'tre em', 'education', 'kindergarten', 'preschool'],
  convenience: ['tien loi', 'minimart', 'tap hoa', 'convenience', 'sieu thi'],
  beauty: ['lam dep', 'spa', 'salon', 'nail', 'toc', 'beauty'],
  pharmacy: ['nha thuoc', 'phong kham', 'y te', 'pharmacy', 'clinic', 'nha khoa'],
  petshop: ['thu cung', 'thu y', 'pet'],
  realestate: ['bat dong san', 'moi gioi', 'real estate', 'estate agent'],
  laundry: ['giat', 'laundry'],
  bookstore: ['nha sach', 'van phong pham', 'book', 'stationery'],
  carwash: ['rua xe', 'sua xe', 'car wash', 'garage', 'xe may'],
};

export function parseIdeaLocal(
  text: string,
  types: { key: string; name: string }[],
  wards: { slug: string; name: string }[],
): ParsedIdea {
  const q = fold(text);
  const amount = (n: string) => Number(n.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
  let budget: number | null = null;
  const big = /(\d+(?:[.,]\d+)*)\s*(ty|ti|billion|bn|b)\b/.exec(q);
  const mid = /(\d+(?:[.,]\d+)*)\s*(trieu|tr|million|m)\b/.exec(q);
  const full = /(\d{1,3}(?:[.,\s]\d{3}){2,})(?!\d)/.exec(q);
  if (big) budget = Math.round(amount(big[1]) * 1e9);
  else if (mid) budget = Math.round(amount(mid[1]) * 1e6);
  else if (full) budget = Number(full[1].replace(/[.,\s]/g, ''));
  if (budget !== null && (!Number.isFinite(budget) || budget < 10_000_000 || budget > 100_000_000_000)) budget = null;

  const type = Object.keys(TYPE_WORDS).find((t) => TYPE_WORDS[t].some((w) => q.includes(w))) ?? null;
  // Longest names first, so "phuong ha dong" is not taken for a shorter name it contains.
  const ward =
    [...wards]
      .sort((a, b) => b.name.length - a.name.length)
      .find((w) => q.includes(fold(w.name)) || q.includes(fold(w.name.replace(/^(Phường|Xã)\s+/, '')))) ?? null;
  return {
    type,
    typeName: types.find((t) => t.key === type)?.name ?? null,
    budget,
    ward: ward ? { slug: ward.slug, name: ward.name } : null,
  };
}
