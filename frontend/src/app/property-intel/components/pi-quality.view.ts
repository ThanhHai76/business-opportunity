import { Lang } from '../pi.models';
import { Source } from '../pi.models';

export type QualityKind = 'official' | 'published' | 'crowdsourced' | 'computed' | 'asking';
export type Confidence = 'high' | 'medium' | 'low';

/** A source's label as the API sends it (backend-node property-intel/model.js QUALITY). */
export interface SourceQuality {
  kind: QualityKind;
  confidence: Confidence;
  /** YYYY-MM-DD or YYYY-MM; null when the source gives no date. */
  asOf: string | null;
}

const KIND: Record<Lang, Record<QualityKind, string>> = {
  vi: { official: 'Số liệu chính thức', published: 'Số liệu đã công bố', crowdsourced: 'Dữ liệu cộng đồng (OSM)', computed: 'Ước tính tính toán', asking: 'Giá chào/dự kiến, ước tính' },
  en: { official: 'Official figure', published: 'Published figure', crowdsourced: 'Community data (OSM)', computed: 'Computed estimate', asking: 'Asking/expected price, estimate' },
};
const CONFIDENCE: Record<Lang, Record<Confidence, string>> = {
  vi: { high: 'độ tin cậy cao', medium: 'độ tin cậy vừa', low: 'độ tin cậy thấp' },
  en: { high: 'high confidence', medium: 'medium confidence', low: 'low confidence' },
};
const AS_OF: Record<Lang, string> = { vi: 'dữ liệu đến', en: 'as of' };

/** "2026-01-01" → "01/01/2026", "2026-09" → "09/2026"; anything else is returned as it is. */
export function formatAsOf(asOf: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(asOf);
  if (!m) return asOf;
  const [, y, mo, d] = m;
  return lang === 'en' ? (d ? `${y}-${mo}-${d}` : `${y}-${mo}`) : d ? `${d}/${mo}/${y}` : `${mo}/${y}`;
}

/** The text of a label: "Số liệu chính thức · độ tin cậy cao · dữ liệu đến 01/01/2026". Without a label: just says it is not rated. */
export function qualityText(q: SourceQuality | null | undefined, lang: Lang): string {
  if (!q) return lang === 'en' ? 'Not rated' : 'Chưa đánh giá';
  const parts = [KIND[lang][q.kind], CONFIDENCE[lang][q.confidence]];
  if (q.asOf) parts.push(`${AS_OF[lang]} ${formatAsOf(q.asOf, lang)}`);
  return parts.join(' · ');
}

/** Whether a source is an estimate rather than a record, so the page can say so (asking prices, computed figures, low confidence). */
export const isEstimate = (q: SourceQuality | null | undefined): boolean => !q || q.kind === 'asking' || q.kind === 'computed' || q.confidence === 'low';

/** Share of a list's sources that are estimates, for a one-line summary. */
export const estimateCount = (sources: Source[]): number => sources.filter((s) => isEstimate(s.quality)).length;
