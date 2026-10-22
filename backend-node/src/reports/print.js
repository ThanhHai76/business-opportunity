'use strict';
/**
 * A paid report as a printable page (A4): the browser's "Save as PDF" makes the file the buyer keeps or sends.
 * Everything shown comes from the frozen report content (src/reports/build.js); every text is escaped.
 */
const { escapeHtml: e } = require('../billing/common');

const nf = (digits) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const num = (v, digits = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : nf(digits).format(v));
/** "45,6 triệu đ" / "1,25 tỷ đ". */
const money = (v) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  return abs >= 1e9 ? `${sign}${num(abs / 1e9, 2)} tỷ đ` : `${sign}${num(abs / 1e6, 1)} triệu đ`;
};
/** Millions with one decimal, for table cells under a "(triệu đ)" header. */
const mil = (v) => `${v < 0 ? '−' : ''}${num(Math.abs(v) / 1e6, 1)}`;
const date = (iso) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const payback = (m) => (m === null ? 'chưa hoàn vốn trong 36 tháng' : `${m} tháng`);

const RISK_LABEL = { low: 'Rủi ro thấp', medium: 'Rủi ro vừa', high: 'Rủi ro cao' };
const RISK_REASON = {
  budget: 'Vốn đầu tư ban đầu vượt số vốn bạn có.',
  noPayback: 'Chưa hoàn vốn trong 36 tháng.',
  slowPayback: 'Hoàn vốn sau 18 tháng.',
  thinMargin: 'Biên lợi nhuận dưới 10% doanh thu.',
  lowMargin: 'Biên lợi nhuận dưới 20% doanh thu.',
  crowded: 'Cạnh tranh dày: phường thuộc nhóm 1/3 có nhiều cơ sở cùng ngành nhất (tính trên số dân).',
};
const FIELDS = [
  ['customers', (a) => (a.basis === 'day' ? 'Khách mỗi ngày' : 'Khách / học viên / giao dịch mỗi tháng'), (v) => num(v)],
  ['ticket', () => 'Chi tiêu trung bình mỗi khách (đ)', (v) => num(v)],
  ['daysOpen', () => 'Ngày mở cửa mỗi tháng', (v) => num(v)],
  ['sizeM2', () => 'Diện tích (m²)', (v) => num(v)],
  ['rentPerM2', () => 'Giá thuê (đ/m²/tháng)', (v) => num(v)],
  ['cogsPct', () => 'Giá vốn (% doanh thu)', (v) => num(v, 1)],
  ['staff', () => 'Số nhân viên', (v) => num(v)],
  ['salary', () => 'Lương mỗi người (đ/tháng)', (v) => num(v)],
  ['utilitiesPerM2', () => 'Điện nước (đ/m²/tháng)', (v) => num(v)],
  ['otherPct', () => 'Marketing & khác (% doanh thu)', (v) => num(v, 1)],
  ['setupPerM2', () => 'Sửa sang, thiết bị (đ/m²)', (v) => num(v)],
  ['depositMonths', () => 'Đặt cọc thuê (tháng)', (v) => num(v)],
  ['budget', () => 'Vốn bạn có (đ)', (v) => num(v)],
  ['rampMonths', () => 'Số tháng để đạt doanh thu đầy đủ', (v) => num(v)],
  ['rampStartPct', () => 'Doanh thu tháng đầu (% mức đầy đủ)', (v) => num(v)],
];

/** Cumulative cash over the months as an inline SVG line, with the zero line and the payback month. */
function cashChart(monthly, paybackMonth) {
  const W = 680;
  const H = 220;
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const values = monthly.map((m) => m.cumulative);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const x = (i) => pad.l + (i / Math.max(1, monthly.length - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + ((hi - v) / span) * (H - pad.t - pad.b);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  // The lowest point, break-even (0) and the highest point; 0 is dropped when it sits on an end.
  const ticks = [...new Set([lo, 0, hi])].map(
    (v) => `<text x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${e(mil(v))}</text>`,
  );
  const months = [1, 6, 12, 18, 24, 30, 36]
    .filter((m) => m <= monthly.length)
    .map((m) => `<text x="${x(m - 1).toFixed(1)}" y="${H - 8}" text-anchor="middle">${m}</text>`);
  const mark =
    paybackMonth !== null
      ? `<line x1="${x(paybackMonth - 1).toFixed(1)}" x2="${x(paybackMonth - 1).toFixed(1)}" y1="${pad.t}" y2="${H - pad.b}" class="mark"/>` +
        `<text x="${(x(paybackMonth - 1) + 4).toFixed(1)}" y="${pad.t + 12}" class="mark-label">hoàn vốn tháng ${paybackMonth}</text>`
      : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Dòng tiền lũy kế 36 tháng (triệu đồng)">
  <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>
  ${mark}
  <polyline points="${points}" class="line"/>
  <g class="axis">${ticks.join('')}${months.join('')}</g>
</svg>`;
}

/** The broker's own header block (company, name, phone, email), and their note for the client. */
function brandHeader(brand) {
  const title = brand.company || brand.name;
  // The person's own details; their name is the title when there is no company.
  const who = [brand.company ? brand.name : '', brand.phone, brand.email].filter(Boolean).map(e).join(' · ');
  return `<div class="brand">${e(title)} · Báo cáo khả thi kinh doanh</div>${who ? `<div class="prepared">Chuẩn bị bởi: ${who}</div>` : ''}`;
}

/**
 * @param report the stored report
 * @param options { brand?: the broker's details to print (Premium), canSwitch?: offer the other version in the toolbar }
 */
function printPage(report, { brand = null, canSwitch = false } = {}) {
  const c = report.content;
  const r = c.feasibility;
  const a = c.assumptions;
  const fitOut = a.setupPerM2 * a.sizeM2;
  const deposit = r.costs.rent * a.depositMonths;
  const verdict =
    c.risk.level === 'low'
      ? 'Theo giả định đã nhập, kế hoạch có lãi và hoàn vốn trong thời gian hợp lý.'
      : c.risk.level === 'medium'
        ? 'Theo giả định đã nhập, kế hoạch khả thi nhưng có điểm cần xem lại (xem phần Rủi ro).'
        : 'Theo giả định đã nhập, kế hoạch rủi ro cao — nên điều chỉnh trước khi đầu tư (xem phần Rủi ro và Kịch bản).';

  const pl = [
    ['Doanh thu', r.revenue],
    ['Tiền thuê', -r.costs.rent],
    ['Lương nhân viên', -r.costs.staff],
    ['Giá vốn hàng bán', -r.costs.cogs],
    ['Điện nước', -r.costs.utilities],
    ['Marketing & khác', -r.costs.other],
  ];

  const scenarioRows = [{ label: 'Kế hoạch của bạn', revenue: r.revenue, profit: r.profit, marginPct: r.marginPct, paybackMonths: r.paybackMonths, base: true }, ...c.sensitivity];

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(report.title)} — Báo cáo khả thi${brand ? '' : ' · Hanoi Century Vista'}</title>
<style>
@page{size:A4;margin:14mm 12mm}
*{box-sizing:border-box}
body{font:13px/1.5 "Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1d1b16;background:#efece5;margin:0}
.page{max-width:820px;margin:0 auto;background:#fff;padding:32px 36px}
.toolbar{max-width:820px;margin:0 auto;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.toolbar button{font:inherit;font-weight:600;padding:10px 16px;border:0;border-radius:8px;background:#1f6f4a;color:#fff;cursor:pointer}
.toolbar span{color:#5c574d}
header{border-bottom:3px solid #1f6f4a;padding-bottom:12px;margin-bottom:18px}
.prepared{margin-top:2px;color:#5c574d;font-size:12px}
.brand-note{margin:14px 0 0;padding:10px 12px;border:1px solid #ddd8cc;border-radius:8px;background:#faf8f3;white-space:pre-line}
.toolbar a{color:#1f6f4a;font-weight:600}
.brand{font-weight:700;letter-spacing:.04em;color:#1f6f4a;text-transform:uppercase;font-size:12px}
h1{font-size:24px;margin:4px 0}
h2{font-size:16px;margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd8cc;break-after:avoid}
.meta{color:#5c574d;font-size:12px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0}
.kpi{border:1px solid #ddd8cc;border-radius:8px;padding:10px 12px}
.kpi b{display:block;font-size:18px}
.kpi span{color:#5c574d;font-size:12px}
.verdict{background:#f3f7f4;border-left:4px solid #1f6f4a;padding:10px 12px;margin:10px 0}
.risk-high{border-left-color:#b3261e;background:#fbf1f0}.risk-medium{border-left-color:#b7791f;background:#fbf6ec}
table{width:100%;border-collapse:collapse;margin:6px 0 4px;font-size:12px}
th,td{padding:5px 6px;border-bottom:1px solid #ebe7de;text-align:right;vertical-align:top}
th:first-child,td:first-child{text-align:left}
thead th{background:#f6f3ec;font-weight:600}
tr{break-inside:avoid}
tr.total td{font-weight:700;border-top:2px solid #1d1b16}
tr.here td{background:#f3f7f4;font-weight:600}
.neg{color:#b3261e}
.two{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
ul{margin:4px 0;padding-left:18px}
.note{color:#5c574d;font-size:11.5px}
.chart{width:100%;height:auto;margin:6px 0}
.chart .line{fill:none;stroke:#1f6f4a;stroke-width:2.2}
.chart .zero{stroke:#8a8478;stroke-dasharray:4 3}
.chart .mark{stroke:#b7791f;stroke-dasharray:3 3}
.chart .mark-label{fill:#b7791f;font-size:11px}
.chart .axis text{fill:#5c574d;font-size:10.5px}
footer{margin-top:24px;padding-top:10px;border-top:1px solid #ddd8cc}
@media (max-width:640px){.page{padding:20px 16px}.two{grid-template-columns:1fr}}
@media print{body{background:#fff}.page{padding:0;max-width:none}.toolbar{display:none}h2{break-after:avoid}}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">Lưu PDF / In</button><span>Trong hộp thoại in, chọn "Lưu dưới dạng PDF".</span>${canSwitch ? (brand ? '<a href="?brand=0">Xem bản chuẩn</a>' : '<a href="?brand=1">Xem bản có thông tin của bạn</a>') : ''}</div>
<div class="page">
<header>
  ${brand ? brandHeader(brand) : '<div class="brand">Hanoi Century Vista · Báo cáo khả thi kinh doanh</div>'}
  <h1>${e(c.type.icon)} ${e(c.type.name)} tại ${e(c.ward.name)}</h1>
  <div class="meta">Mốc: ${c.horizon === '2030' ? '2030 (có tín hiệu tăng trưởng)' : 'hiện tại'} · Tạo ngày ${e(date(c.generatedAt))} · Dữ liệu bản đồ ngày ${e(c.dataDate ? date(c.dataDate) : '—')} · Mã báo cáo ${e(report.id.slice(0, 8).toUpperCase())}</div>
  ${brand?.note ? `<p class="brand-note">${e(brand.note)}</p>` : ''}
</header>

<h2>1. Tóm tắt</h2>
<div class="kpis">
  <div class="kpi"><span>Điểm cơ hội</span><b>${num(c.score.opportunity, 1)}/100</b><span>hạng ${num(c.score.rank)}/${num(c.score.of)} phường</span></div>
  <div class="kpi"><span>Lợi nhuận mỗi tháng*</span><b class="${r.profit < 0 ? 'neg' : ''}">${e(money(r.profit))}</b><span>biên ${num(r.marginPct, 0)}% doanh thu</span></div>
  <div class="kpi"><span>Vốn đầu tư ban đầu</span><b>${e(money(r.investment))}</b><span>${r.budgetGap >= 0 ? `còn dư ${e(money(r.budgetGap))}` : `thiếu ${e(money(-r.budgetGap))}`}</span></div>
  <div class="kpi"><span>Hoàn vốn</span><b>${e(payback(r.paybackMonths))}</b><span>đã tính giai đoạn khởi động</span></div>
</div>
<p class="verdict risk-${e(c.risk.level)}"><strong>${e(RISK_LABEL[c.risk.level])}.</strong> ${e(verdict)}</p>
<p class="note">* Khi doanh thu đã đạt mức đầy đủ. ${c.assumptionsAreDefault ? 'Báo cáo dùng giả định mặc định của ngành — hãy thay bằng số liệu thật (báo giá thuê, giá bán, lương) để có kết quả sát hơn.' : 'Báo cáo dùng giả định bạn đã nhập (mục 8).'}</p>

<h2>2. ${e(c.ward.name)}: nhu cầu và cạnh tranh</h2>
<div class="two">
<table><tbody>
  <tr><td>Dân số (1/7/2025)</td><td>${num(c.ward.population)}</td></tr>
  <tr><td>Diện tích</td><td>${num(c.ward.areaKm2, 2)} km²</td></tr>
  <tr><td>Chỉ số nhu cầu</td><td>${num(c.score.demand, 1)}/100</td></tr>
  <tr><td>Chỉ số cạnh tranh</td><td>${num(c.score.competition, 1)}/100</td></tr>
  <tr><td>Cơ sở cùng ngành trên bản đồ</td><td>${num(c.score.count)} (${num(c.score.per10k, 1)}/10.000 dân)</td></tr>
  <tr><td>Giá đất nhà nước VT1 (trung vị)</td><td>${c.ward.landMedian === null ? '—' : `${num(c.ward.landMedian, 1)} tr/m²`}</td></tr>
  <tr><td>Trung vị toàn thành phố</td><td>${c.ward.landCityMedian === null ? '—' : `${num(c.ward.landCityMedian, 1)} tr/m²`}</td></tr>
</tbody></table>
<div>
  <p style="margin:6px 0 4px"><strong>Điều gì tạo nên nhu cầu ở đây</strong> (giá trị so với các phường × trọng số của ngành):</p>
  <ul>${c.score.drivers.map((d) => `<li>${e(d.label)}: ${num(d.value, 0)}/100 × ${num(d.weight, 2)} = ${num(d.points, 1)} điểm</li>`).join('')}</ul>
  ${c.ward.metroStations?.length ? `<p class="note">Ga metro đang khai thác trong phường: ${e(c.ward.metroStations.join(', '))}.</p>` : ''}
  ${c.score.confidence === 'low' ? '<p class="note">Độ tin cậy thấp: bản đồ ghi nhận ít cơ sở của ngành này, nên chỉ số cạnh tranh có thể chưa chính xác.</p>' : ''}
</div>
</div>

<h2>3. Kết quả kinh doanh mỗi tháng (khi đạt doanh thu đầy đủ)</h2>
<div class="two">
<table><thead><tr><th>Khoản</th><th>triệu đ</th></tr></thead><tbody>
  ${pl.map(([label, v]) => `<tr><td>${label}</td><td class="${v < 0 ? 'neg' : ''}">${mil(v)}</td></tr>`).join('')}
  <tr class="total"><td>Lợi nhuận</td><td class="${r.profit < 0 ? 'neg' : ''}">${mil(r.profit)}</td></tr>
</tbody></table>
<table><thead><tr><th>Vốn ban đầu</th><th>triệu đ</th></tr></thead><tbody>
  <tr><td>Sửa sang, thiết bị (${num(a.sizeM2)} m²)</td><td>${mil(fitOut)}</td></tr>
  <tr><td>Đặt cọc thuê (${num(a.depositMonths)} tháng)</td><td>${mil(deposit)}</td></tr>
  <tr class="total"><td>Tổng vốn cần</td><td>${mil(r.investment)}</td></tr>
  <tr><td>Vốn bạn có</td><td>${mil(a.budget)}</td></tr>
  <tr><td>${r.budgetGap >= 0 ? 'Còn dư' : 'Còn thiếu'}</td><td class="${r.budgetGap < 0 ? 'neg' : ''}">${mil(Math.abs(r.budgetGap))}</td></tr>
</tbody></table>
</div>
${r.breakEvenCustomers !== null ? `<p>Điểm hoà vốn: cần khoảng <strong>${num(r.breakEvenCustomers)} khách ${a.basis === 'day' ? 'mỗi ngày' : 'mỗi tháng'}</strong> để đủ trả chi phí cố định (thuê, lương, điện nước).</p>` : ''}

<h2>4. Dòng tiền ${num(c.horizonMonths)} tháng</h2>
<p class="note">Bắt đầu từ −vốn đầu tư; doanh thu tăng dần từ ${num(a.rampStartPct)}% lên mức đầy đủ trong ${num(a.rampMonths)} tháng. Đơn vị: triệu đồng.</p>
${cashChart(c.monthly, r.paybackMonths)}
<table><thead><tr><th>Tháng</th><th>% doanh thu</th><th>Doanh thu</th><th>Chi phí biến đổi</th><th>Chi phí cố định</th><th>Dòng tiền tháng</th><th>Lũy kế</th></tr></thead><tbody>
${c.monthly
  .map(
    (m) =>
      `<tr${m.month === r.paybackMonths ? ' class="here"' : ''}><td>${m.month}</td><td>${num(m.levelPct)}%</td><td>${mil(m.sales)}</td><td>${mil(m.variable)}</td><td>${mil(m.fixed)}</td><td class="${m.cash < 0 ? 'neg' : ''}">${mil(m.cash)}</td><td class="${m.cumulative < 0 ? 'neg' : ''}">${mil(m.cumulative)}</td></tr>`,
  )
  .join('\n')}
</tbody></table>

<h2>5. Nếu thực tế khác kế hoạch</h2>
<table><thead><tr><th>Kịch bản</th><th>Doanh thu/tháng (tr)</th><th>Lợi nhuận/tháng (tr)</th><th>Biên lãi</th><th>Hoàn vốn</th></tr></thead><tbody>
${scenarioRows
  .map(
    (s) =>
      `<tr${s.base ? ' class="here"' : ''}><td>${e(s.label)}</td><td>${mil(s.revenue)}</td><td class="${s.profit < 0 ? 'neg' : ''}">${mil(s.profit)}</td><td>${num(s.marginPct, 0)}%</td><td>${e(payback(s.paybackMonths))}</td></tr>`,
  )
  .join('')}
</tbody></table>

<h2>6. Rủi ro: ${e(RISK_LABEL[c.risk.level])}</h2>
${c.risk.reasons.length ? `<ul>${c.risk.reasons.map((k) => `<li>${e(RISK_REASON[k] ?? k)}</li>`).join('')}</ul>` : '<p>Không có điểm rủi ro nào theo các tiêu chí bên dưới.</p>'}
<p class="note">Cách tính: vượt vốn +2 điểm; không hoàn vốn trong 36 tháng +2 (sau 18 tháng +1); biên lãi dưới 10% +2 (dưới 20% +1); cạnh tranh từ 66/100 +1. Từ 4 điểm: rủi ro cao; 2–3 điểm: vừa.</p>

<h2>7. So với các phường khác</h2>
<p>Cùng kế hoạch đặt ở ${num(c.plan.of)} phường có điểm: ${e(c.ward.name)} đứng <strong>thứ ${num(c.plan.rank)}</strong>. Các phường xếp trên cùng:</p>
<table><thead><tr><th>Phường</th><th>Điểm</th><th>Lợi nhuận/tháng (tr)</th><th>Hoàn vốn</th><th>Vốn cần (tr)</th><th>Rủi ro</th></tr></thead><tbody>
${[...(c.plan.here ? [{ ...c.plan.here, here: true }] : []), ...c.plan.alternatives]
  .map(
    (p) =>
      `<tr${p.here ? ' class="here"' : ''}><td>${e(p.name)}${p.here ? ' (phường của bạn)' : ''}</td><td>${num(p.score, 1)}</td><td class="${p.profit < 0 ? 'neg' : ''}">${mil(p.profit)}</td><td>${e(payback(p.paybackMonths))}</td><td>${mil(p.investment)}${p.fits ? '' : ' (vượt vốn)'}</td><td>${e(RISK_LABEL[p.risk])}</td></tr>`,
  )
  .join('')}
</tbody></table>
<p class="note">Bảng này ước tính lại kế hoạch cho từng phường: số khách nhân theo điểm cơ hội so với phường trung vị (×0,6–1,4), giá thuê nhân theo giá đất nhà nước so với trung vị thành phố (×0,5–2,5). Vì vậy số của phường bạn ở đây có thể khác mục 3, vốn dùng đúng giả định bạn nhập.</p>

<h2>8. Giả định đã dùng</h2>
<table><tbody>
${FIELDS.filter(([key]) => key !== 'daysOpen' || a.basis === 'day')
  .map(([key, label, fmt]) => `<tr><td>${e(label(a))}</td><td>${e(fmt(a[key]))}</td></tr>`)
  .join('')}
</tbody></table>

<h2>9. Phương pháp và nguồn</h2>
<p>${e(c.method)}</p>
<p class="note">${e(c.caveat)}</p>
<ul class="note">${c.sources.map((s) => `<li>${e(s.title)} — ${e(s.publisher)} · ${e(s.url)}</li>`).join('')}</ul>

<footer class="note">
  Báo cáo này là công cụ tham khảo, không phải lời khuyên đầu tư hay dự báo doanh thu. Điểm cơ hội so sánh các phường từ dữ liệu
  OpenStreetMap (chưa ghi nhận đủ cửa hàng nhỏ); phần tài chính dựa hoàn toàn vào giả định ở mục 8. Giá đất là bảng giá nhà nước,
  thường thấp hơn giá thị trường. Hãy khảo sát thực địa và lấy báo giá thật trước khi quyết định.
  Bản đồ dữ liệu © OpenStreetMap contributors (ODbL).
  ${brand ? 'Số liệu phân tích: Hanoi Century Vista.' : ''}
</footer>
</div>
</body></html>`;
}

module.exports = { printPage };
