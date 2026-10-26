import { Brand } from '../services/billing.service';
import { Direction, SOURCES } from './career.data';
import { labelsIn } from './career.labels';
import { CareerLang, channelsIn, localeOf, sourceTitleIn } from './career.local';
import { Profile, Ranked, backgroundLabel } from './career.logic';
import { PlanItem, afterThirtyDays, phasesIn } from './career.plan';

/** A place of work as the plan prints it. */
export interface PrintPlace {
  name: string;
  kind: 'now' | 'plan';
  note: string;
  /** How far it is from the visitor's ward ('' when they gave none). */
  commute: string;
  /** The nearest wards, as text. */
  near: string;
  sources: string[];
}

export interface PrintInput {
  direction: Direction;
  items: PlanItem[];
  done: ReadonlySet<string>;
  profile: Profile;
  /** Why the direction fits (null when the questions were not all answered). */
  ranked: Ranked | null;
  places: PrintPlace[];
  wardName: string;
  startedAt: string;
  generatedAt: Date;
  /** The details of the person who prepares the plan (Premium): they replace the site's name in the header. */
  brand: Brand | null;
  /** The language of the page; the direction, the items and the places arrive already in it. */
  lang?: CareerLang;
}

/** The words of the printed plan, in both languages. */
const TEXT = {
  vi: {
    kicker: 'Kế hoạch nghề nghiệp',
    prepared: 'Chuẩn bị bởi',
    unanswered: 'chưa trả lời',
    situation: 'Hoàn cảnh',
    background: 'Nghề hiện tại, nghề cũ hoặc ngành đã học',
    education: 'Trình độ',
    time: 'Thời gian học thêm',
    work: 'Làm thuê hay tự kinh doanh',
    home: 'Nơi ở',
    fit: (n: number) => `Mức phù hợp: ${n}/100.`,
    noFit: 'Chưa trả lời đủ câu hỏi nên chưa có điểm phù hợp.',
    placesTitle: 'Nơi làm việc và khoảng cách',
    plan: 'theo quy hoạch',
    landmark: 'điểm mốc',
    from: (ward: string, commute: string) => `Từ ${ward}: ${commute}.`,
    nearest: 'Phường/xã gần nhất',
    placesNote: 'Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm. Thời gian lái xe tính bằng ô tô, đường thông thoáng; giờ cao điểm lâu hơn nhiều. Dữ liệu bản đồ © OpenStreetMap contributors (ODbL).',
    roles: 'Vị trí thường gặp',
    skills: 'Kỹ năng cần có',
    toolbar: 'Lưu PDF / In',
    toolbarHint: 'Trong hộp thoại in, chọn "Lưu dưới dạng PDF".',
    defaultBrand: 'Hanoi Century Vista · La bàn nghề nghiệp Hà Nội',
    title: (name: string) => `Kế hoạch nghề nghiệp: ${name}`,
    started: 'Bắt đầu',
    made: 'Lập ngày',
    done: (a: number, b: number) => `Đã làm ${a}/${b} việc`,
    about: 'Về bạn',
    why: 'Vì sao hướng này',
    changing: 'Hà Nội đang thay đổi thế nào',
    thirty: 'Kế hoạch 30 ngày',
    after: 'Sau 30 ngày:',
    channels: 'Nơi tìm việc chính thống',
    channelsNote: 'Cảnh giác với lời mời việc làm đòi tiền đặt cọc. Chính sách hỗ trợ người thất nghiệp theo Luật Việc làm 2025: hỏi trung tâm dịch vụ việc làm về điều kiện và thủ tục hiện hành.',
    sources: 'Nguồn',
    footer: 'Kế hoạch này là công cụ tham khảo, không đảm bảo việc làm hay thu nhập. Phần lớn nguồn là báo chí dẫn lại số liệu và kế hoạch của cơ quan nhà nước: hãy đối chiếu với văn bản gốc trước khi quyết định.',
    analysis: ' Số liệu phân tích: Hanoi Century Vista.',
    pageTitle: ' · Hanoi Century Vista',
  },
  en: {
    kicker: 'Career plan',
    prepared: 'Prepared by',
    unanswered: 'not answered',
    situation: 'Situation',
    background: 'Current or former job, or field of study',
    education: 'Education',
    time: 'Time to train',
    work: 'Employee or self-employed',
    home: 'Where you live',
    fit: (n: number) => `Fit: ${n}/100.`,
    noFit: 'Not all the questions were answered, so there is no fit score.',
    placesTitle: 'Where to work, and distances',
    plan: 'under the plan',
    landmark: 'reference point',
    from: (ward: string, commute: string) => `From ${ward}: ${commute}.`,
    nearest: 'Nearest wards and communes',
    placesNote: 'A planned pole is a direction of development, not a place that already has the jobs. Driving times are by car on free-flowing roads; rush hour is much longer. Map data © OpenStreetMap contributors (ODbL).',
    roles: 'Common roles',
    skills: 'Skills needed',
    toolbar: 'Save PDF / Print',
    toolbarHint: 'In the print dialog, choose "Save as PDF".',
    defaultBrand: 'Hanoi Century Vista · Hanoi Career Compass',
    title: (name: string) => `Career plan: ${name}`,
    started: 'Started',
    made: 'Prepared on',
    done: (a: number, b: number) => `${a}/${b} tasks done`,
    about: 'About you',
    why: 'Why this direction',
    changing: 'How Hanoi is changing',
    thirty: '30-day plan',
    after: 'After 30 days:',
    channels: 'Official places to look for work',
    channelsNote: 'Be wary of job offers that ask for a deposit. Support for the unemployed under the Employment Law 2025: ask the employment service centre about the current conditions and procedure.',
    sources: 'Sources',
    footer: 'This plan is a reference tool and does not guarantee a job or income. Most of the sources are press reports repeating the figures and plans of State agencies, and they are in Vietnamese: check them against the original documents before deciding.',
    analysis: ' Analysis: Hanoi Century Vista.',
    pageTitle: ' · Hanoi Century Vista',
  },
} as const;

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const date = (d: Date | string, lang: CareerLang): string => new Date(d).toLocaleDateString(localeOf(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });

/** The sources of a figure as "[n]" (n: its number in the list of sources, the same as on the page). */
function cite(ids: string[], used: Set<string>): string {
  return ids
    .map((id) => {
      const i = SOURCES.findIndex((s) => s.id === id);
      if (i < 0) return '';
      used.add(id);
      return `<sup>[${i + 1}]</sup>`;
    })
    .join('');
}

function brandHeader(brand: Brand, lang: CareerLang): string {
  const t = TEXT[lang];
  const title = brand.company || brand.name;
  const who = [brand.company ? brand.name : '', brand.phone, brand.email].filter(Boolean).map(esc).join(' · ');
  return `<div class="brand">${esc(title)} · ${t.kicker}</div>${who ? `<div class="prepared">${t.prepared}: ${who}</div>` : ''}`;
}

/** The printed career plan (A4): the browser's "Save as PDF" makes the file. Everything shown is escaped. */
export function planPrintHtml(i: PrintInput): string {
  const lang = i.lang ?? 'vi';
  const t = TEXT[lang];
  const labels = labelsIn(lang);
  const phases = phasesIn(lang);
  const used = new Set<string>();
  const d = i.direction;
  const p = i.profile;
  const label = <T extends string | number>(list: { value: T; label: string }[], v: T | null): string => list.find((x) => x.value === v)?.label ?? t.unanswered;
  const doneCount = i.items.filter((x) => i.done.has(x.id)).length;
  const answers: [string, string][] = [
    [t.situation, label(labels.situations, p.situation)],
    [t.background, p.backgrounds.length ? p.backgrounds.map((b) => backgroundLabel(b, lang)).join('; ') : t.unanswered],
    [t.education, label(labels.educations, p.education)],
    [t.time, label(labels.times, p.time)],
    [t.work, label(labels.works, p.work)],
    ...(i.wardName ? ([[t.home, i.wardName]] as [string, string][]) : []),
  ];

  const why = i.ranked
    ? `<p class="verdict"><strong>${esc(t.fit(i.ranked.score))}</strong></p>
<ul>${i.ranked.reasons.map((t) => `<li>${esc(t)}</li>`).join('')}${i.ranked.cautions.map((t) => `<li class="warn">${esc(t)}</li>`).join('')}</ul>`
    : `<p class="note">${t.noFit}</p>`;

  const steps = phases.map((ph) => {
    const rows = i.items.filter((x) => x.phase === ph.id);
    return `<h3>${esc(ph.title)}</h3>
<ul class="tasks">${rows
      .map((x) => `<li class="${i.done.has(x.id) ? 'is-done' : ''}"><span class="box" aria-hidden="true">${i.done.has(x.id) ? '☑' : '☐'}</span><span>${esc(x.text)}${cite(x.sources ?? [], used)}</span></li>`)
      .join('')}</ul>`;
  }).join('\n');

  const places = i.places.length
    ? `<h2>4. ${t.placesTitle}</h2>
<ul class="places">${i.places
        .map(
          (x) =>
            `<li><strong>${esc(x.name)}</strong> <span class="tag">${x.kind === 'plan' ? t.plan : t.landmark}</span><br>${esc(x.note)}${cite(x.sources, used)}${x.commute ? `<br><em>${esc(t.from(i.wardName, x.commute))}</em>` : ''}${x.near ? `<br>${t.nearest}: ${esc(x.near)}.` : ''}</li>`,
        )
        .join('')}</ul>
<p class="note">${t.placesNote}</p>`
    : '';
  const placeNo = i.places.length ? 5 : 4;

  const facts = d.facts.map((f) => `<li>${esc(f.text)}${cite(f.sources, used)}</li>`).join('');
  const channels = channelsIn(lang).map((c) => `<li>${esc(c.name)}: ${esc(c.url)}${cite(c.sources, used)}</li>`).join('');
  // Cited before the list of sources is made, so the list has them.
  const supportCites = cite(['luat-viec-lam', 'lsvn-bhtn'], used);
  const sources = [...used]
    .map((id) => SOURCES.findIndex((s) => s.id === id))
    .sort((a, b) => a - b)
    .map((idx) => `<li value="${idx + 1}">${esc(sourceTitleIn(SOURCES[idx], lang))} — ${esc(SOURCES[idx].publisher)} · ${esc(SOURCES[idx].url)}</li>`)
    .join('');

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.name)} — ${t.kicker}${i.brand ? '' : t.pageTitle}</title>
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
h2{font-size:16px;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd8cc;break-after:avoid}
h3{font-size:14px;margin:14px 0 4px;break-after:avoid}
.meta{color:#5c574d;font-size:12px}
.brand-note{margin:14px 0 0;padding:10px 12px;border:1px solid #ddd8cc;border-radius:8px;background:#faf8f3;white-space:pre-line}
table{width:100%;border-collapse:collapse;font-size:12.5px}
td,th{padding:5px 6px;border-bottom:1px solid #ebe7de;text-align:left;vertical-align:top}
th{width:38%;font-weight:600;color:#5c574d}
ul{margin:4px 0;padding-left:18px}
.verdict{background:#f3f7f4;border-left:4px solid #1a7f4b;padding:8px 12px;margin:8px 0}
.warn{color:#8a5a00}
.tasks{list-style:none;padding:0}
.tasks li{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f0ece3;break-inside:avoid}
.tasks .box{font-size:15px;line-height:1.2}
.tasks li.is-done span:last-child{color:#7a756a;text-decoration:line-through}
.places{padding-left:18px}.places li{margin:0 0 8px;break-inside:avoid}
.tag{font-size:11px;padding:0 6px;border:1px solid #c9c3b5;border-radius:999px;color:#5c574d}
.note{color:#5c574d;font-size:11.5px}
sup{font-size:9px;color:#1a7f4b}
footer{margin-top:24px;padding-top:10px;border-top:1px solid #ddd8cc}
@media print{body{background:#fff}.page{padding:0;max-width:none}.toolbar{display:none}}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">${t.toolbar}</button><span>${t.toolbarHint}</span></div>
<div class="page">
<header>
  ${i.brand ? brandHeader(i.brand, lang) : `<div class="brand">${t.defaultBrand}</div>`}
  <h1>${esc(d.icon)} ${esc(t.title(d.name))}</h1>
  <div class="meta">${t.started} ${esc(date(i.startedAt, lang))} · ${t.made} ${esc(date(i.generatedAt, lang))} · ${esc(t.done(doneCount, i.items.length))}</div>
  ${i.brand?.note ? `<p class="brand-note">${esc(i.brand.note)}</p>` : ''}
</header>

<h2>1. ${t.about}</h2>
<table><tbody>${answers.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>

<h2>2. ${t.why}</h2>
<p>${esc(d.blurb)}</p>
${why}

<h2>3. ${t.changing}</h2>
<ul>${facts}</ul>
<p class="note">${t.roles}: ${esc(d.roles.join('; '))}. ${t.skills}: ${esc(d.skills.join('; '))}.</p>

${places}

<h2>${placeNo}. ${t.thirty}</h2>
${steps}
<p><strong>${t.after}</strong> ${esc(afterThirtyDays(d))}</p>

<h2>${placeNo + 1}. ${t.channels}</h2>
<ul>${channels}</ul>
<p class="note">${t.channelsNote}${supportCites}</p>

<h2>${t.sources}</h2>
<ol class="note">${sources}</ol>

<footer class="note">
  ${t.footer}${i.brand ? t.analysis : ''}
</footer>
</div>
</body></html>`;
}
