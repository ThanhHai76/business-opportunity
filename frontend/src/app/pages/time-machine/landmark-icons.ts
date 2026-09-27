/**
 * Line-art icons for the Time Machine landmarks (24×24 viewBox, stroked with currentColor).
 * Each entry is the inner markup of the <svg>; use {@link landmarkIcon} to get a complete element string.
 */
const WAVES = '<path d="M3 20.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>';

export const LANDMARK_ICONS: Record<string, string> = {
  // Tháp Rùa giữa hồ
  'hoan-kiem':
    '<path d="M12 3.5V5"/><path d="M9.5 5.5h5l-.6 3h-3.8z"/><path d="M8.5 8.5h7v4h-7z"/><path d="M7 12.5h10V16H7z"/>' +
    '<path d="M11 16v-1.2a1 1 0 0 1 2 0V16"/>' + WAVES,
  // Dãy nhà ống phố cổ
  'old-quarter':
    '<path d="M3 20v-9l3-3 3 3v9"/><path d="M9 20V8l3-3 3 3v12"/><path d="M15 20v-9l3-3 3 3v9"/>' +
    '<path d="M2 20h20"/><path d="M6 13v2M12 10.5v2M18 13v2"/><path d="M11 20v-3h2v3"/>',
  // Lăng Chủ tịch Hồ Chí Minh
  'ba-dinh':
    '<path d="M4.5 5h15v2.6h-15z"/><path d="M7 7.6V15M10 7.6V15M14 7.6V15M17 7.6V15"/>' +
    '<path d="M5 15h14v3H5z"/><path d="M3 18h18v3H3z"/>',
  // Khuê Văn Các
  'van-mieu':
    '<path d="M4 8.5c2 .2 3.5-.6 4.5-2.5h7c1 1.9 2.5 2.7 4.5 2.5"/><path d="M7.5 8.5h9V13h-9z"/>' +
    '<circle cx="12" cy="10.75" r="1.3"/><path d="M5 13h14"/><path d="M6 13v8M18 13v8"/>' +
    '<path d="M10 21v-3.5a2 2 0 0 1 4 0V21"/><path d="M3 21h18"/>',
  // Nhà hát Lớn: mái vòm, trán tường, hàng cột
  'opera-house':
    '<path d="M12 3.5V5"/><path d="M8.8 8.8a3.2 3.2 0 0 1 6.4 0"/><path d="M4 12l8-3.2 8 3.2z"/>' +
    '<path d="M6 12v6M10 12v6M14 12v6M18 12v6"/><path d="M4 18h16"/><path d="M3 21h18"/>',
  // Chùa Một Cột: toà sen trên một cột giữa hồ
  'mot-cot':
    '<path d="M4.5 8c2.5 0 4-1.2 5-3h5c1 1.8 2.5 3 5 3"/><path d="M7 8h10v4H7z"/><path d="M5.5 12h13"/>' +
    '<path d="M8 12l4 3 4-3"/><path d="M12 15v4"/>' + WAVES,
  // Cột cờ Hà Nội
  'hoang-thanh':
    '<path d="M12 2.5v5.5"/><path d="M12 3l4 1.3-4 1.3"/><path d="M9.5 8h5"/><path d="M10.5 8h3v7h-3z"/>' +
    '<path d="M8.5 15h7v2.8h-7z"/><path d="M5 17.8h14V21H5z"/>',
  // Cầu Long Biên: dầm thép vòm
  'long-bien':
    '<path d="M2 16h20"/><path d="M2.5 16Q6.5 8 10.5 16"/><path d="M13.5 16Q17.5 8 21.5 16"/>' +
    '<path d="M4.5 13.2 6.5 16l2-2.8M15.5 13.2l2 2.8 2-2.8"/><path d="M3 16v4M12 16v4M21 16v4"/>' +
    '<path d="M5.5 20.5h3M15.5 20.5h3"/>',
  // Nhà thờ Lớn: hai tháp chuông
  'nha-tho-lon':
    '<path d="M4 21V9l2.5-4L9 9v12"/><path d="M15 21V9l2.5-4L20 9v12"/><path d="M9 12l3-2 3 2"/>' +
    '<circle cx="12" cy="14" r="1"/><path d="M10.5 21v-3a1.5 1.5 0 0 1 3 0v3"/>' +
    '<path d="M6.5 2v3M5.6 3h1.8M17.5 2v3M16.6 3h1.8"/><path d="M6.5 12.5v2.5M17.5 12.5v2.5"/><path d="M3 21h18"/>',
  // Bảo tháp chùa Trấn Quốc
  'tran-quoc':
    '<path d="M12 2.5v4"/><path d="M8 19 9.5 6.5h5L16 19"/><path d="M7.3 16h9.4M7.7 13h8.6M8 10h8M8.6 7.3h6.8"/>' +
    '<path d="M6 19h12v2H6z"/>',
  // Cổng nhà tù Hỏa Lò
  'hoa-lo':
    '<path d="M4 21V8h16v13"/><path d="M3 8h18"/><path d="M7.5 5h9v3h-9z"/>' +
    '<path d="M8 21v-7a4 4 0 0 1 8 0v7"/><path d="M10.7 10.4V21M13.3 10.4V21"/><path d="M2 21h20"/>',
  // Chợ Đồng Xuân: mặt tiền nhiều đầu hồi
  'dong-xuan':
    '<path d="M3 20v-9l3-3 3 3 3-3 3 3 3-3 3 3v9"/><path d="M2 20h20"/><path d="M10 20v-4.5h4V20"/>' +
    '<path d="M5 14h2M17 14h2"/><circle cx="12" cy="11.5" r="1"/>',
  // Ga Hà Nội: đầu tàu hoả
  'ga-ha-noi':
    '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10h12"/><path d="M9.5 6.5h5"/>' +
    '<circle cx="9" cy="13.5" r=".7" fill="currentColor"/><circle cx="15" cy="13.5" r=".7" fill="currentColor"/>' +
    '<path d="M9 16.5l-2 4M15 16.5l2 4"/><path d="M5 20.5h14"/>',
};

/** Complete, decorative <svg> string for a landmark (empty string for an unknown key). */
export function landmarkIcon(key: string, cls = 'tm-ico'): string {
  const body = LANDMARK_ICONS[key];
  if (!body) return '';
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}
