import { Brand } from '../services/billing.service';
import { CHART, chartData } from './career.switch-chart';
import { SWITCH_TEXT } from './career.switch-text';
import { CASE_IDS, CaseId, CaseResult, NET_AT, Reference, SwitchInput, compute, remarks } from './career.switch';
import { CareerLang, localeOf } from './career.local';

export interface SwitchPrintInput {
  options: SwitchInput[];
  generatedAt: Date;
  /** The details of the person who prepares the plan (Premium): they replace the site's name in the header. */
  brand: Brand | null;
  lang?: CareerLang;
  /** The reference figures to print with their sources. */
  references: Reference[];
}

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const COLORS: Record<CaseId, string> = { careful: '#b45309', base: '#1a7f4b', bright: '#2563eb' };

/** The printed career-change plan (A4): the browser's "Save as PDF" makes the file. Everything shown is escaped. */
export function switchPrintHtml(i: SwitchPrintInput): string {
  const lang = i.lang ?? 'vi';
  const t = SWITCH_TEXT[lang];
  const nf = new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 });
  const num = (n: number): string => nf.format(n);
  const signed = (n: number): string => (n > 0 ? '+' : '') + num(n);
  const when = i.generatedAt.toLocaleDateString(localeOf(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });

  const brandHeader = (b: Brand): string => {
    const who = [b.company ? b.name : '', b.phone, b.email].filter(Boolean).map(esc).join(' · ');
    return `<div class="brand">${esc(b.company || b.name)} · ${t.kicker}</div>${who ? `<div class="prepared">${t.prepared}: ${who}</div>` : ''}`;
  };

  const results = i.options.map((o) => compute(o));
  const optionName = (o: SwitchInput, n: number): string => o.name.trim() || t.untitled(n + 1);

  const chart = (r: Record<CaseId, CaseResult>): string => {
    const c = chartData(r);
    const { width, height, left, right, bottom } = CHART;
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(t.chartAria(t.payback(r.base.paybackMonths)))}">
${c.zeroY === null ? '' : `<line x1="${left}" x2="${width - right}" y1="${c.zeroY}" y2="${c.zeroY}" stroke="#888" stroke-dasharray="4 3"/>`}
<text x="${left - 6}" y="${c.maxY + 4}" text-anchor="end" font-size="10" fill="#555">${esc(num(c.max))}</text>
<text x="${left - 6}" y="${c.minY + 4}" text-anchor="end" font-size="10" fill="#555">${esc(num(c.min))}</text>
${c.ticks.map((k) => `<text x="${k.x}" y="${height - bottom + 16}" text-anchor="middle" font-size="10" fill="#555">${k.label}</text>`).join('')}
${c.lines.map((l) => `<path d="${l.d}" fill="none" stroke="${COLORS[l.id]}" stroke-width="${l.id === 'base' ? 2.6 : 1.4}"/>`).join('')}
</svg>
<div class="legend">${CASE_IDS.map((id) => `<span><i style="background:${COLORS[id]}"></i>${esc(t.cases[id])}</span>`).join('')} · ${esc(t.month)}</div>`;
  };

  const caseTable = (r: Record<CaseId, CaseResult>): string => {
    const row = (label: string, cell: (c: CaseResult) => string): string => `<tr><th scope="row">${esc(label)}</th>${CASE_IDS.map((id) => `<td>${cell(r[id])}</td>`).join('')}</tr>`;
    return `<table class="cases"><thead><tr><th></th>${CASE_IDS.map((id) => `<th>${esc(t.cases[id])}</th>`).join('')}</tr></thead><tbody>
${row(t.rowNewIncome, (c) => esc(num(c.newIncome)))}
${row(t.rowSearch, (c) => String(c.searchMonths))}
${row(t.rowCost, (c) => esc(num(c.totalCost)))}
${row(t.rowPayback, (c) => `<strong>${esc(t.payback(c.paybackMonths))}</strong>`)}
${NET_AT.map((m) => row(t.rowNet(m), (c) => esc(signed(c.net[m])))).join('\n')}
${row(t.rowBuffer, (c) => `${esc(num(c.buffer))}${c.bufferMonths === null ? '' : `<br><small>${esc(t.bufferMonths(num(c.bufferMonths)))}</small>`}`)}
</tbody></table>`;
  };

  const blocks = i.options
    .map((o, n) => {
      const r = results[n];
      const inputs = t.fields.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(num(o[f.key]))} ${esc(f.unit)}</td></tr>`).join('');
      const notes = remarks(o, r.base).map((k) => `<li class="warn">${esc(t.remarks[k])}</li>`).join('');
      return `<section class="opt">
<h2>${n + 1}. ${esc(optionName(o, n))}</h2>
<h3>${t.inputsTitle}</h3>
<table class="inputs"><tbody>${inputs}</tbody></table>
<h3>${t.resultsTitle}</h3>
${caseTable(r)}
<p class="note">${t.caseNote}</p>
${notes ? `<ul>${notes}</ul>` : ''}
<h3>${esc(t.chartTitle)}</h3>
${chart(r)}
</section>`;
    })
    .join('\n');

  const compare =
    i.options.length > 1
      ? `<section class="opt"><h2>${esc(t.compareTitle)}</h2>
<table class="cases"><thead><tr><th></th>${i.options.map((o, n) => `<th>${esc(optionName(o, n))}</th>`).join('')}</tr></thead><tbody>
<tr><th scope="row">${esc(t.rowCost)}</th>${results.map((r) => `<td>${esc(num(r.base.totalCost))}</td>`).join('')}</tr>
<tr><th scope="row">${esc(t.rowPayback)}</th>${results.map((r) => `<td><strong>${esc(t.payback(r.base.paybackMonths))}</strong></td>`).join('')}</tr>
${[24, 36].map((m) => `<tr><th scope="row">${esc(t.rowNet(m))}</th>${results.map((r) => `<td>${esc(signed(r.base.net[m as 24 | 36]))}</td>`).join('')}</tr>`).join('')}
<tr><th scope="row">${esc(t.rowBuffer)}</th>${results.map((r) => `<td>${esc(num(r.base.buffer))}</td>`).join('')}</tr>
</tbody></table><p class="note">${esc(t.compareNote)}</p></section>`
      : '';

  const refs = i.references
    .map(
      (ref) =>
        `<li>${esc(lang === 'en' ? ref.en : ref.vi)}${ref.sources.map((s) => `<br><small>${esc(lang === 'en' ? s.en : s.vi)} — ${esc(s.publisher)} · ${esc(s.url)}</small>`).join('')}</li>`,
    )
    .join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.kicker)}${i.brand ? '' : t.pageTitle}</title>
<style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}
body{font:13px/1.5 "Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1d1b16;background:#efece5;margin:0}
.page{max-width:820px;margin:0 auto;background:#fff;padding:32px 36px}
.toolbar{max-width:820px;margin:0 auto;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.toolbar button{font:inherit;font-weight:600;padding:10px 16px;border:0;border-radius:8px;background:#1a7f4b;color:#fff;cursor:pointer}
.toolbar span{color:#5c574d}
header{border-bottom:3px solid #1a7f4b;padding-bottom:12px;margin-bottom:18px}
.brand{font-weight:700;letter-spacing:.04em;color:#1a7f4b;text-transform:uppercase;font-size:12px}
.prepared{margin-top:2px;color:#5c574d;font-size:12px}
h1{font-size:24px;margin:4px 0}
h2{font-size:16px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd8cc;break-after:avoid}
h3{font-size:13px;margin:12px 0 4px;color:#5c574d;break-after:avoid}
.meta{color:#5c574d;font-size:12px}
.brand-note{margin:14px 0 0;padding:10px 12px;border:1px solid #ddd8cc;border-radius:8px;background:#faf8f3;white-space:pre-line}
table{width:100%;border-collapse:collapse;font-size:12.5px}
td,th{padding:5px 6px;border-bottom:1px solid #ebe7de;text-align:left;vertical-align:top}
.inputs th{width:55%;font-weight:600;color:#5c574d}
.cases th{font-weight:600}.cases thead th{background:#f3f7f4}.cases td{text-align:right}.cases thead th:not(:first-child){text-align:right}
ul{margin:4px 0;padding-left:18px}
.warn{color:#8a5a00}
.note{color:#5c574d;font-size:11.5px}
.opt{break-inside:avoid-page}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#5c574d}
.legend i{display:inline-block;width:14px;height:3px;margin-right:4px;vertical-align:middle}
small{color:#5c574d}
footer{margin-top:24px;padding-top:10px;border-top:1px solid #ddd8cc}
@media print{body{background:#fff}.page{padding:0;max-width:none}.toolbar{display:none}}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">${t.toolbar}</button><span>${t.toolbarHint}</span></div>
<div class="page">
<header>
  ${i.brand ? brandHeader(i.brand) : `<div class="brand">${t.defaultBrand}</div>`}
  <h1>${esc(t.kicker)}</h1>
  <div class="meta">${t.madeOn} ${esc(when)}</div>
  ${i.brand?.note ? `<p class="brand-note">${esc(i.brand.note)}</p>` : ''}
</header>
${blocks}
${compare}
<h2>${t.sources}</h2>
<ol class="note">${refs}</ol>
<footer class="note">${t.footer}${i.brand ? t.analysis : ''}</footer>
</div>
</body></html>`;
}
