import { Brand } from '../services/billing.service';
import { CHANNELS, Direction, SOURCES } from './career.data';
import { EDUCATIONS, SITUATIONS, TIMES, WORKS } from './career.labels';
import { BACKGROUND_LABEL, Profile, Ranked } from './career.logic';
import { PHASES, PlanItem, afterThirtyDays } from './career.plan';

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
}

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const date = (d: Date | string): string => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

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

function brandHeader(brand: Brand): string {
  const title = brand.company || brand.name;
  const who = [brand.company ? brand.name : '', brand.phone, brand.email].filter(Boolean).map(esc).join(' · ');
  return `<div class="brand">${esc(title)} · Kế hoạch nghề nghiệp</div>${who ? `<div class="prepared">Chuẩn bị bởi: ${who}</div>` : ''}`;
}

/** The printed career plan (A4): the browser's "Save as PDF" makes the file. Everything shown is escaped. */
export function planPrintHtml(i: PrintInput): string {
  const used = new Set<string>();
  const d = i.direction;
  const p = i.profile;
  const label = <T extends string | number>(list: { value: T; label: string }[], v: T | null): string => list.find((x) => x.value === v)?.label ?? 'chưa trả lời';
  const doneCount = i.items.filter((x) => i.done.has(x.id)).length;
  const answers: [string, string][] = [
    ['Hoàn cảnh', label(SITUATIONS, p.situation)],
    ['Nghề hiện tại, nghề cũ hoặc ngành đã học', p.backgrounds.length ? p.backgrounds.map((b) => BACKGROUND_LABEL[b]).join('; ') : 'chưa trả lời'],
    ['Trình độ', label(EDUCATIONS, p.education)],
    ['Thời gian học thêm', label(TIMES, p.time)],
    ['Làm thuê hay tự kinh doanh', label(WORKS, p.work)],
    ...(i.wardName ? ([['Nơi ở', i.wardName]] as [string, string][]) : []),
  ];

  const why = i.ranked
    ? `<p class="verdict"><strong>Mức phù hợp: ${esc(i.ranked.score)}/100.</strong></p>
<ul>${i.ranked.reasons.map((t) => `<li>${esc(t)}</li>`).join('')}${i.ranked.cautions.map((t) => `<li class="warn">${esc(t)}</li>`).join('')}</ul>`
    : '<p class="note">Chưa trả lời đủ câu hỏi nên chưa có điểm phù hợp.</p>';

  const steps = PHASES.map((ph) => {
    const rows = i.items.filter((x) => x.phase === ph.id);
    return `<h3>${esc(ph.title)}</h3>
<ul class="tasks">${rows
      .map((x) => `<li class="${i.done.has(x.id) ? 'is-done' : ''}"><span class="box" aria-hidden="true">${i.done.has(x.id) ? '☑' : '☐'}</span><span>${esc(x.text)}${cite(x.sources ?? [], used)}</span></li>`)
      .join('')}</ul>`;
  }).join('\n');

  const places = i.places.length
    ? `<h2>4. Nơi làm việc và khoảng cách</h2>
<ul class="places">${i.places
        .map(
          (x) =>
            `<li><strong>${esc(x.name)}</strong> <span class="tag">${x.kind === 'plan' ? 'theo quy hoạch' : 'điểm mốc'}</span><br>${esc(x.note)}${cite(x.sources, used)}${x.commute ? `<br><em>Từ ${esc(i.wardName)}: ${esc(x.commute)}.</em>` : ''}${x.near ? `<br>Phường/xã gần nhất: ${esc(x.near)}.` : ''}</li>`,
        )
        .join('')}</ul>
<p class="note">Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm. Thời gian lái xe tính bằng ô tô, đường thông thoáng; giờ cao điểm lâu hơn nhiều. Dữ liệu bản đồ © OpenStreetMap contributors (ODbL).</p>`
    : '';
  const placeNo = i.places.length ? 5 : 4;

  const facts = d.facts.map((f) => `<li>${esc(f.text)}${cite(f.sources, used)}</li>`).join('');
  const channels = CHANNELS.map((c) => `<li>${esc(c.name)}: ${esc(c.url)}${cite(c.sources, used)}</li>`).join('');
  // Cited before the list of sources is made, so the list has them.
  const supportCites = cite(['luat-viec-lam', 'lsvn-bhtn'], used);
  const sources = [...used]
    .map((id) => SOURCES.findIndex((s) => s.id === id))
    .sort((a, b) => a - b)
    .map((idx) => `<li value="${idx + 1}">${esc(SOURCES[idx].title)} — ${esc(SOURCES[idx].publisher)} · ${esc(SOURCES[idx].url)}</li>`)
    .join('');

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.name)} — Kế hoạch nghề nghiệp${i.brand ? '' : ' · Hanoi Century Vista'}</title>
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
<div class="toolbar"><button type="button" onclick="window.print()">Lưu PDF / In</button><span>Trong hộp thoại in, chọn "Lưu dưới dạng PDF".</span></div>
<div class="page">
<header>
  ${i.brand ? brandHeader(i.brand) : '<div class="brand">Hanoi Century Vista · La bàn nghề nghiệp Hà Nội</div>'}
  <h1>${esc(d.icon)} Kế hoạch nghề nghiệp: ${esc(d.name)}</h1>
  <div class="meta">Bắt đầu ${esc(date(i.startedAt))} · Lập ngày ${esc(date(i.generatedAt))} · Đã làm ${doneCount}/${i.items.length} việc</div>
  ${i.brand?.note ? `<p class="brand-note">${esc(i.brand.note)}</p>` : ''}
</header>

<h2>1. Về bạn</h2>
<table><tbody>${answers.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>

<h2>2. Vì sao hướng này</h2>
<p>${esc(d.blurb)}</p>
${why}

<h2>3. Hà Nội đang thay đổi thế nào</h2>
<ul>${facts}</ul>
<p class="note">Vị trí thường gặp: ${esc(d.roles.join('; '))}. Kỹ năng cần có: ${esc(d.skills.join('; '))}.</p>

${places}

<h2>${placeNo}. Kế hoạch 30 ngày</h2>
${steps}
<p><strong>Sau 30 ngày:</strong> ${esc(afterThirtyDays(d))}</p>

<h2>${placeNo + 1}. Nơi tìm việc chính thống</h2>
<ul>${channels}</ul>
<p class="note">Cảnh giác với lời mời việc làm đòi tiền đặt cọc. Chính sách hỗ trợ người thất nghiệp theo Luật Việc làm 2025: hỏi trung tâm dịch vụ việc làm về điều kiện và thủ tục hiện hành.${supportCites}</p>

<h2>Nguồn</h2>
<ol class="note">${sources}</ol>

<footer class="note">
  Kế hoạch này là công cụ tham khảo, không đảm bảo việc làm hay thu nhập. Phần lớn nguồn là báo chí dẫn lại số liệu và kế hoạch của cơ quan nhà nước:
  hãy đối chiếu với văn bản gốc trước khi quyết định.${i.brand ? ' Số liệu phân tích: Hanoi Century Vista.' : ''}
</footer>
</div>
</body></html>`;
}
