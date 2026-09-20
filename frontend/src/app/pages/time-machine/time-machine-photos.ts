/**
 * Real photographs of the five landmarks, from Wikimedia Commons (public domain or Creative Commons).
 * Files live in public/images/time-machine/<landmark>-<era>.jpg. Every entry keeps the real date of the
 * photo in its caption — a few are from a nearby year rather than the exact era, and say so.
 *
 * Eras without an entry (and the 2050/2100 scenarios) fall back to the stylised illustration.
 */
export interface LandmarkPhoto {
  src: string;
  alt: string;
  /** What the photo shows, with its real date. */
  caption: string;
  author: string;
  license: string;
  /** Commons file page: full credit, original size and licence text. */
  pageUrl: string;
  /** `cover` (default) fills the frame; `contain` shows a portrait photo whole. */
  fit?: 'cover' | 'contain';
  /** CSS object-position used when the photo is cropped. */
  position?: string;
}

const PD = 'Phạm vi công cộng';
const commons = (file: string): string => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
const src = (key: string): string => `/images/time-machine/${key}.jpg`;

export const LANDMARK_PHOTOS: Record<string, Record<string, LandmarkPhoto>> = {
  'hoan-kiem': {
    '1926': {
      src: src('hoan-kiem-1926'),
      alt: 'Ảnh đen trắng cũ chụp Hồ Gươm với cây cầu gỗ và các mái đình bên bờ hồ',
      caption: 'Hồ Gươm và cầu gỗ bên bờ hồ, khoảng năm 1900',
      author: 'Ảnh tư liệu (Revue illustrée, 1902)',
      license: PD,
      pageUrl: commons('Hanoï le Petit Lac vers 1900.jpg'),
    },
    '1954': {
      src: src('hoan-kiem-1954'),
      alt: 'Đông người đi trên cầu Thê Húc dẫn vào đền Ngọc Sơn dịp Tết năm 1954',
      caption: 'Đông người qua cầu Thê Húc dịp Tết, tháng 2/1954',
      author: 'Daniel Camus / ECPAD',
      license: PD,
      pageUrl: commons("HA 54-11 R29 Foule sur le pont du lac Hoan Kiem ou lac de l'Epée restituée lors de la fête du Têt.jpg"),
      position: '50% 55%',
    },
    '2026': {
      src: src('hoan-kiem-2026'),
      alt: 'Tháp Rùa giữa Hồ Gươm, phản chiếu trên mặt nước lúc hoàng hôn',
      caption: 'Tháp Rùa giữa Hồ Gươm, 2014',
      author: 'P. Hughes',
      license: 'CC BY 4.0',
      pageUrl: commons('Hanoi - Turtle Tower (Tháp Rùa), Hoàn Kiếm Lake.jpg'),
      position: '50% 55%',
    },
  },
  'old-quarter': {
    '1926': {
      src: src('old-quarter-1926'),
      alt: 'Phố Hàng Điếu thời Pháp thuộc với xe kéo, hàng cây cao và nhà mặt phố',
      caption: 'Phố Hàng Điếu (rue des Pipes), thập niên 1920',
      author: 'Không rõ tác giả',
      license: PD,
      pageUrl: commons('La rue des Pipes, Hanoi.jpg'),
    },
    '1954': {
      src: src('old-quarter-1954'),
      alt: 'Một phố ở Hà Nội tháng 10 năm 1954, cờ đỏ sao vàng treo trước những ngôi nhà',
      caption: 'Một con phố Hà Nội, tháng 10/1954',
      author: 'Không rõ tác giả',
      license: PD,
      pageUrl: commons('Một con phố Hà Nội vào tháng 10 năm 1954.jpg'),
      fit: 'contain',
    },
    '1975': {
      src: src('old-quarter-1975'),
      alt: 'Ngã tư đông xe đạp, xích lô và xe buýt ở trung tâm Hà Nội cuối thập niên 1970',
      caption: 'Giao thông ở trung tâm Hà Nội, năm 1978',
      author: 'Uwe Gerig (Deutsche Fotothek)',
      license: 'CC BY-SA 3.0 DE',
      pageUrl: commons('Fotothek-df ge 0000152-Vietnam 1978. Verkehr im Stadtzentrum von Hanoi.jpg'),
    },
    '2026': {
      src: src('old-quarter-2026'),
      alt: 'Một góc phố cổ Hà Nội với những ngôi nhà nhiều tầng, đèn lồng và xe máy',
      caption: 'Một góc Phố Cổ, tháng 11/2024',
      author: 'Alexkom000',
      license: 'CC BY 4.0',
      pageUrl: commons("2024-11-03 Hanoi's Old Quarter 7.jpg"),
      position: '50% 60%',
    },
  },
  'ba-dinh': {
    '1954': {
      src: src('ba-dinh-1954'),
      alt: 'Các chiến sĩ vẫy mũ tiến vào Hà Nội trong ngày tiếp quản Thủ đô',
      caption: 'Bộ đội tiến vào tiếp quản Thủ đô, 10/1954 (một con phố nội thành, không rõ vị trí)',
      author: 'Không rõ tác giả',
      license: PD,
      pageUrl: commons('1stIndochinaWar005.jpg'),
      position: '50% 35%',
    },
    '1975': {
      src: src('ba-dinh-1975'),
      alt: 'Lễ đài Tuyên ngôn Độc lập tại Quảng trường Ba Đình ngày 2/9/1945',
      caption: 'Lễ đài Tuyên ngôn Độc lập tại Ba Đình, 2/9/1945',
      author: 'Mặt trận Việt Minh (tư liệu)',
      license: PD,
      pageUrl: commons("Président Ho-chi-Minh lit la Proclamation-d'indépendance sur la place Ba-dinh le 2nd Sep 1945.jpg"),
      fit: 'contain',
    },
    '2026': {
      src: src('ba-dinh-2026'),
      alt: 'Đội danh dự trong lễ thượng cờ trước Lăng Chủ tịch Hồ Chí Minh',
      caption: 'Lăng Chủ tịch Hồ Chí Minh và đội danh dự, 2007',
      author: 'shunei1506',
      license: 'CC BY 2.0',
      pageUrl: commons('Ba Dinh Square.jpg'),
      position: '50% 65%',
    },
  },
  'van-mieu': {
    '1926': {
      src: src('van-mieu-1926'),
      alt: 'Các quan mặc phẩm phục trong buổi tế lễ ở sân Văn Miếu',
      caption: 'Lễ tế tại Văn Miếu, khoảng 1919–1928',
      author: 'René Tétart',
      license: PD,
      pageUrl: commons('Mandarin in Van Mieu1.jpg'),
    },
    '2026': {
      src: src('van-mieu-2026'),
      alt: 'Khuê Văn Các nhìn từ con đường lát gạch giữa vườn cây của Văn Miếu',
      caption: 'Khuê Văn Các nhìn từ lối đi trong Văn Miếu, 2006',
      author: 'Chuoibk (Wikipedia tiếng Anh)',
      license: 'CC BY-SA 3.0',
      pageUrl: commons('Hanoi Temple of Literature.jpg'),
    },
  },
  'opera-house': {
    '1926': {
      src: src('opera-house-1926'),
      alt: 'Bưu thiếp cũ chụp Nhà Hát Lớn và phố Paul Bert với xe bò, xe kéo',
      caption: 'Nhà Hát Lớn trên bưu thiếp đầu thế kỷ 20',
      author: 'Bưu thiếp P. Dieulefils',
      license: PD,
      pageUrl: commons('Hanoï - Théâtre rue Paul Bert.jpg'),
    },
    '1954': {
      src: src('opera-house-1954'),
      alt: 'Đám đông và lực lượng vũ trang mít tinh trước Nhà Hát Lớn cuối tháng 8 năm 1945',
      caption: 'Mít tinh trước Nhà Hát Lớn, cuối tháng 8/1945',
      author: 'Không rõ tác giả',
      license: PD,
      pageUrl: commons('Mít tinh chào mừng Cách mạng Tháng Tám năm 1945 thành công tại Nhà hát Lớn Hà Nội.jpg'),
    },
    '2026': {
      src: src('opera-house-2026'),
      alt: 'Mặt trước Nhà Hát Lớn Hà Nội màu vàng dưới bầu trời xanh, cờ Tổ quốc trên nóc',
      caption: 'Nhà Hát Lớn Hà Nội, 2016',
      author: 'xiquinhosilva',
      license: 'CC BY 2.0',
      pageUrl: commons('Hanoi Opera House, 24 December 2016.jpg'),
      position: '50% 40%',
    },
  },
};
