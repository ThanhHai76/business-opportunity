/**
 * The Time Machine's source content, in Vietnamese: the six eras, the landmark stories and the reviewed
 * answers to the suggested chat questions. English translations live in tm-i18n.ts.
 *
 * backend-node/scripts/sync-time-machine.js reads ERAS and LANDMARKS for the AI Storyteller — run
 * `npm run sync:time-machine` there after editing them.
 */
export interface Era {
  id: string;
  year: string;
  label: string;
  tag: string;
  future: boolean;
}

export interface Landmark {
  name: string;
  sub: string;
  stories: Record<string, string>;
}

export interface ChatAnswer {
  q: string;
  a: string;
  src: string;
  future: boolean;
}

export const ERAS: Era[] = [
  { id: '1926', year: '1926', label: 'Thời Pháp thuộc', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
  { id: '1954', year: '1954', label: 'Giải phóng Thủ đô', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
  { id: '1975', year: '1975', label: 'Thống nhất đất nước', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
  { id: '2026', year: '2026', label: 'Hiện tại', tag: 'HIỆN TẠI', future: false },
  { id: '2050', year: '2050', label: 'Kịch bản tương lai', tag: 'KỊCH BẢN TƯƠNG LAI', future: true },
  { id: '2100', year: '2100', label: 'Kịch bản viễn tưởng', tag: 'KỊCH BẢN TƯƠNG LAI', future: true },
];

export const LANDMARKS: Record<string, Landmark> = {
  'hoan-kiem': {
    name: 'Hồ Gươm',
    sub: 'Hoàn Kiếm Lake & Tháp Rùa',
    stories: {
      '1926': 'Dưới thời Pháp thuộc, Hồ Gươm là ranh giới giữa khu phố Tây quy hoạch kiểu Paris ở phía Nam và phố cổ buôn bán tấp nập ở phía Bắc. Tháp Rùa đã đứng đó từ 1886.',
      '1954': 'Ngày 10/10/1954, đoàn quân giải phóng tiến qua khu vực quanh hồ trong ngày Hà Nội được giải phóng khỏi thực dân Pháp — một khoảnh khắc được ghi lại nhiều nhất trong lịch sử hiện đại của thành phố.',
      '1975': 'Sau ngày thống nhất, Hồ Gươm trở thành không gian công cộng biểu tượng của thủ đô một nước Việt Nam thống nhất, nơi diễn ra các lễ mít tinh lớn.',
      '2026': 'Không gian đi bộ quanh hồ cuối tuần thu hút hàng chục nghìn người, xen giữa nhịp sống hiện đại là truyền thuyết vua Lê Lợi trả gươm thần cho rùa vàng vẫn được kể lại mỗi ngày.',
      '2050': 'Mặt hồ được bảo tồn trong một "vùng lõi di sản" không phương tiện cơ giới, bao quanh bởi các tầng đi bộ trên cao kết nối với toàn khu phố cổ.',
      '2100': 'Tháp Rùa được số hoá thành một điểm neo thực tế hỗn hợp, nơi du khách có thể "gặp" các nhân vật lịch sử được AI tái hiện ngay tại chỗ.',
    },
  },
  'old-quarter': {
    name: 'Phố Cổ',
    sub: '36 phố phường',
    stories: {
      '1926': '36 phố phường vẫn giữ nếp "buôn có bạn, bán có phường" — mỗi phố một nghề, từ Hàng Bạc đến Hàng Mã — dù kiến trúc Pháp đã bắt đầu xen vào nhà ống truyền thống.',
      '1954': 'Sau giải phóng, nhiều cửa hiệu tư sản dần chuyển đổi mô hình, phố cổ bước vào giai đoạn kinh tế tập thể với nhịp sống trầm lắng hơn thời thuộc địa.',
      '1975': 'Phố cổ trở thành khu dân cư đông đúc bậc nhất Hà Nội thời bao cấp, nhiều nhà ống bị chia nhỏ cho nhiều hộ gia đình sinh sống chung.',
      '2026': 'Phố cổ vừa là di sản sống vừa là điểm đến du lịch sầm uất nhất Hà Nội — phố đi bộ cuối tuần, quán cà phê trong nhà ống trăm tuổi, xen giữa mật độ dân cư cao nhất thành phố.',
      '2050': 'Mặt tiền lịch sử được giữ nguyên theo luật bảo tồn nghiêm ngặt, trong khi phần sau mỗi nhà ống được cải tạo bằng công nghệ xây dựng module để nâng chất lượng sống.',
      '2100': 'Toàn bộ phố cổ trở thành một "bảo tàng sống" được giám sát bởi cảm biến khí hậu vi mô, tự động điều tiết để bảo vệ vật liệu di sản trước biến đổi khí hậu.',
    },
  },
  'ba-dinh': {
    name: 'Quảng trường Ba Đình',
    sub: 'Ba Dinh Square',
    stories: {
      '1926': 'Khu vực Ba Đình thời Pháp thuộc là quần thể hành chính - dinh thự của chính quyền Đông Dương, quy hoạch theo lối phương Tây với đại lộ rộng và Phủ Toàn quyền uy nghi.',
      '1954': 'Ba Đình chuyển từ trung tâm quyền lực thực dân thành trung tâm chính trị của nước Việt Nam Dân chủ Cộng hoà sau ngày giải phóng Thủ đô.',
      '1975': 'Không gian quảng trường gắn liền với ngày 2/9/1945 — nơi Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập — và tiếp tục là nơi diễn ra các sự kiện trọng đại của đất nước thống nhất.',
      '2026': 'Lễ thượng cờ - hạ cờ mỗi ngày tại quảng trường vẫn thu hút đông đảo người dân và du khách; Lăng Chủ tịch Hồ Chí Minh nằm ngay trung tâm khu vực.',
      '2050': 'Khu vực xung quanh quảng trường mở rộng không gian xanh và giao thông công cộng, hạn chế phương tiện cá nhân để bảo tồn cảnh quan nghi lễ.',
      '2100': 'Các nghi lễ quốc gia được phát dưới dạng trải nghiệm thực tế hỗn hợp cho người Việt khắp nơi trên thế giới "hiện diện" cùng lúc tại quảng trường.',
    },
  },
  'van-mieu': {
    name: 'Văn Miếu',
    sub: 'Temple of Literature · est. 1070',
    stories: {
      '1926': 'Dưới thời Pháp, Văn Miếu - Quốc Tử Giám không còn chức năng thi cử (khoa cử bị bãi bỏ từ 1919) nhưng vẫn là biểu tượng học vấn Nho giáo giữa một Hà Nội đang Âu hoá.',
      '1954': 'Sau giải phóng, di tích được chính quyền mới tiếp quản và bắt đầu được nhìn nhận lại như một di sản giáo dục dân tộc cần bảo tồn, dù trùng tu còn hạn chế do chiến tranh.',
      '1975': 'Văn Miếu dần được đầu tư tu bổ như biểu tượng hiếu học của dân tộc thống nhất, đón học sinh sinh viên đến "xin chữ" trước mỗi kỳ thi.',
      '2026': '82 bia Tiến sĩ (Di sản Tư liệu Thế giới UNESCO) là điểm đến không thể thiếu của học sinh trước mùa thi và du khách quốc tế tìm hiểu truyền thống khoa bảng Việt Nam.',
      '2050': 'Bia Tiến sĩ được quét 3D độ phân giải cao, cho phép nghiên cứu văn tự cổ từ xa mà không cần chạm vào hiện vật gốc.',
      '2100': 'Một "phiên bản song sinh số" đầy đủ của Văn Miếu tồn tại song song, cho phép hậu thế "bước vào" không gian thi cử xưa dù bản gốc có biến đổi thế nào.',
    },
  },
  'opera-house': {
    name: 'Nhà Hát Lớn',
    sub: 'Hanoi Opera House · 1911',
    stories: {
      '1926': 'Hoàn thành năm 1911 theo phong cách Beaux-Arts, Nhà Hát Lớn là nơi giới thượng lưu Pháp và bản xứ thưởng thức opera, kịch nói — biểu tượng cho tham vọng biến Hà Nội thành "Paris thu nhỏ".',
      '1954': 'Sau giải phóng, Nhà Hát Lớn trở thành nơi diễn ra các sự kiện chính trị - văn hoá quan trọng của chính quyền mới, chuyển từ không gian giải trí thượng lưu sang không gian công cộng.',
      '1975': 'Công trình tiếp tục là sân khấu biểu diễn nghệ thuật hàng đầu cả nước thời kỳ thống nhất, dù cơ sở vật chất xuống cấp nhiều sau chiến tranh.',
      '2026': 'Sau nhiều đợt trùng tu, Nhà Hát Lớn là điểm diễn hoà nhạc, opera, sự kiện cao cấp bậc nhất Hà Nội, kiến trúc Pháp cổ nằm giữa các toà nhà hiện đại xung quanh.',
      '2050': 'Nội thất lịch sử được số hoá toàn bộ, cho phép dàn dựng các buổi diễn "hồi sinh" nghệ sĩ và tiết mục nổi tiếng đầu thế kỷ 20 bằng hologram trên chính sân khấu gốc.',
      '2100': 'Nhà Hát Lớn trở thành nút giao giữa biểu diễn trực tiếp và khán giả ảo toàn cầu, âm thanh kiến trúc gốc được bảo tồn tuyệt đối.',
    },
  },
  'mot-cot': {
    name: 'Chùa Một Cột',
    sub: 'One Pillar Pagoda · 1049',
    stories: {
      '1926': 'Ngôi chùa hình bông sen trên một cột đá giữa hồ vuông, dựng năm 1049 thời vua Lý Thái Tông, nằm lặng lẽ cạnh khu dinh thự hành chính của chính quyền Pháp ở Ba Đình.',
      '1954': 'Ngày 11/9/1954, trước khi rút khỏi Hà Nội, quân đội Pháp đặt mìn phá huỷ chùa. Năm 1955, chùa được dựng lại theo đúng kiến trúc cũ.',
      '1975': 'Chùa nằm ngay bên cạnh Lăng Chủ tịch Hồ Chí Minh vừa khánh thành năm 1975, trở thành một phần của quần thể di tích Ba Đình.',
      '2026': 'Một trong những biểu tượng kiến trúc độc đáo nhất của Hà Nội, là điểm dừng quen thuộc của du khách khi thăm quần thể Lăng Bác – Phủ Chủ tịch.',
      '2050': 'Kết cấu gỗ và cột đá được theo dõi bằng cảm biến độ ẩm, rung chấn; mặt hồ và cảnh quan quanh chùa được phục dựng theo tư liệu cổ.',
      '2100': 'Một bản song sinh số cho phép du khách "bước lên" đài sen và xem lại lần dựng chùa năm 1049 lẫn lần phục dựng năm 1955.',
    },
  },
  'hoang-thanh': {
    name: 'Hoàng thành Thăng Long',
    sub: 'Imperial Citadel · Cột cờ 1812',
    stories: {
      '1926': 'Phần lớn thành Hà Nội đã bị người Pháp phá dỡ cuối thế kỷ 19 để lấy đất xây doanh trại; còn lại Đoan Môn, Hậu Lâu, Bắc Môn và Cột cờ Hà Nội dựng năm 1812.',
      '1954': 'Sau ngày tiếp quản Thủ đô, khu thành cổ trở thành nơi làm việc của Bộ Quốc phòng — một không gian quân sự khép kín với người dân.',
      '1975': 'Từ Nhà D67 và hầm chỉ huy trong khu thành, Bộ Chính trị và Quân uỷ Trung ương theo dõi, chỉ đạo các chiến dịch cho tới Mùa Xuân 1975.',
      '2026': 'Khu trung tâm Hoàng thành được UNESCO công nhận Di sản Văn hoá Thế giới năm 2010; khu khảo cổ 18 Hoàng Diệu hé lộ dấu tích nhiều triều đại chồng lớp.',
      '2050': 'Các lớp khảo cổ được mở rộng khai quật và trưng bày dưới mái che trong suốt, cho phép nhìn xuyên qua nhiều tầng lịch sử ngay tại chỗ.',
      '2100': 'Toàn bộ kinh thành Thăng Long qua các triều đại được tái dựng số hoá; du khách chọn một thế kỷ và "đi bộ" trong cung điện đã mất.',
    },
  },
  'long-bien': {
    name: 'Cầu Long Biên',
    sub: 'Long Biên Bridge · 1902',
    stories: {
      '1926': 'Mang tên cầu Paul Doumer, hoàn thành năm 1902, dài khoảng 1,7 km — khi ấy là cây cầu duy nhất bắc qua sông Hồng, chở cả tàu hoả, xe kéo và người đi bộ.',
      '1954': 'Tháng 10/1954, những đơn vị lính Pháp cuối cùng rút qua cầu sang bên kia sông; cây cầu được đổi tên thành cầu Long Biên.',
      '1975': 'Cầu bị ném bom nhiều lần trong các năm 1967 và 1972, nhiều nhịp bị đánh sập nhưng liên tục được sửa chữa để giữ mạch giao thông Bắc – Nam.',
      '2026': 'Chỉ dành cho tàu hoả, xe máy, xe đạp và người đi bộ; trở thành chứng nhân lịch sử, điểm ngắm hoàng hôn và bãi giữa sông Hồng.',
      '2050': 'Cầu được gia cố và giữ nguyên dáng thép cổ; hai đầu cầu là không gian công cộng ven sông với đường đi bộ dọc hành lang xanh sông Hồng.',
      '2100': 'Cây cầu trở thành bảo tàng ngoài trời vắt qua sông, nơi mỗi nhịp thép kể một chương lịch sử bằng thực tế tăng cường.',
    },
  },
  'nha-tho-lon': {
    name: 'Nhà thờ Lớn Hà Nội',
    sub: "St. Joseph's Cathedral · 1886",
    stories: {
      '1926': 'Khánh thành dịp Giáng sinh năm 1886, xây theo lối Gothic trên nền chùa Báo Thiên cũ — tháp chuông đôi là điểm cao nổi bật của khu phố quanh Hồ Gươm.',
      '1954': 'Sau Hiệp định Genève, nhiều giáo dân miền Bắc di cư vào Nam; nhà thờ vẫn là trung tâm của Tổng giáo phận Hà Nội.',
      '1975': 'Những năm sau thống nhất, các thánh lễ vẫn được duy trì; mặt tiền rêu phong của nhà thờ trở thành hình ảnh quen thuộc của Hà Nội thời bao cấp.',
      '2026': 'Đông nghịt người mỗi dịp Giáng sinh; quanh nhà thờ là những quán "trà chanh" vỉa hè và cà phê — một góc sống động của Hà Nội hiện đại.',
      '2050': 'Quảng trường trước nhà thờ trở thành không gian đi bộ, mặt đá và kính màu được trùng tu bằng kỹ thuật quét 3D.',
      '2100': 'Âm thanh chuông và thánh ca nguyên bản được lưu trữ số, phát lại trong những đêm lễ hội ánh sáng trên mặt tiền cổ.',
    },
  },
  'tran-quoc': {
    name: 'Hồ Tây & Chùa Trấn Quốc',
    sub: 'West Lake · chùa hơn 1.400 năm',
    stories: {
      '1926': 'Hồ Tây rộng hơn 500 ha, bao quanh là làng cá, làng hoa; chùa Trấn Quốc — ngôi chùa có lịch sử từ thế kỷ 6 — nằm trên đảo nhỏ, nối với đê Cổ Ngư.',
      '1954': 'Năm 1957, thanh niên Thủ đô tham gia tôn tạo đê Cổ Ngư; con đường được đổi tên thành đường Thanh Niên.',
      '1975': 'Ven hồ vẫn là những làng Quảng An, Nhật Tân, Quảng Bá với đầm sen, vườn đào — lá phổi xanh ở rìa đô thị.',
      '2026': 'Tây Hồ là khu ở của nhiều người nước ngoài, với khách sạn, quán cà phê ven hồ; trà sen Tây Hồ và hoàng hôn trên hồ là đặc sản.',
      '2050': 'Đường đi bộ và xe đạp chạy vòng quanh hồ, các đầm sen được phục hồi như vùng đất ngập nước đô thị.',
      '2100': 'Hồ Tây trở thành trung tâm của một mạng lưới hồ điều hoà sinh thái, giúp thành phố chống ngập và hạ nhiệt.',
    },
  },
  'hoa-lo': {
    name: 'Nhà tù Hỏa Lò',
    sub: 'Maison Centrale · 1896',
    stories: {
      '1926': 'Nhà tù trung ương do người Pháp xây từ năm 1896, giam giữ hàng nghìn tù nhân, trong đó có rất nhiều người Việt yêu nước và chiến sĩ cách mạng.',
      '1954': 'Sau khi tiếp quản Thủ đô, nhà tù được chính quyền Việt Nam tiếp tục sử dụng làm trại giam.',
      '1975': 'Giai đoạn 1964–1973 nơi đây giam giữ phi công Mỹ bị bắn rơi, được họ gọi đùa là "Hanoi Hilton"; tù binh được trao trả năm 1973.',
      '2026': 'Phần lớn khu nhà tù bị phá dỡ vào thập niên 1990 để xây cao ốc; phần còn lại trở thành di tích – bảo tàng thu hút đông khách tham quan.',
      '2050': 'Bảo tàng mở rộng kho tư liệu số hoá: thư từ, hồ sơ, lời kể nhân chứng được tra cứu tự do cho học sinh và nhà nghiên cứu.',
      '2100': 'Trải nghiệm tái hiện lịch sử có hướng dẫn giúp thế hệ sau cảm nhận bối cảnh của những người từng bị giam giữ nơi đây.',
    },
  },
  'dong-xuan': {
    name: 'Chợ Đồng Xuân',
    sub: 'Dong Xuan Market · 1889',
    stories: {
      '1926': 'Khai trương năm 1889 với mái tôn năm gian, là chợ lớn nhất Hà Nội — nơi hàng hoá từ khắp Bắc Kỳ đổ về phố cổ.',
      '1954': 'Chợ từng là chiến trường ác liệt trong những ngày Hà Nội kháng chiến 1946–1947; sau năm 1954 trở lại là trung tâm buôn bán của Thủ đô.',
      '1975': 'Thời bao cấp, chợ chủ yếu là các quầy mậu dịch; người dân xếp hàng với tem phiếu, bên cạnh những gánh hàng nhỏ quanh chợ.',
      '2026': 'Sau vụ hoả hoạn năm 1994, chợ được xây lại và giữ mặt tiền cũ; ngày nay là chợ bán buôn sầm uất, cuối tuần có chợ đêm dọc phố Hàng Đào.',
      '2050': 'Logistics giao hàng chuyển ra ngoài giờ cao điểm bằng xe điện nhỏ; mặt tiền lịch sử và mái chợ cũ được bảo tồn.',
      '2100': 'Chợ vừa là nơi buôn bán vừa là bảo tàng sống về nghề buôn phố cổ, với các gian hàng truyền thống được gìn giữ.',
    },
  },
  'ga-ha-noi': {
    name: 'Ga Hà Nội',
    sub: 'Ga Hàng Cỏ · 1902',
    stories: {
      '1926': 'Nhà ga trung tâm (ga Hàng Cỏ) hoàn thành năm 1902, đầu mối các tuyến đường sắt đi Hải Phòng, Lào Cai và vào phía Nam.',
      '1954': 'Sau ngày tiếp quản, nhà ga là cửa ngõ đường sắt chính của Thủ đô miền Bắc.',
      '1975': 'Đại sảnh bị bom Mỹ đánh sập năm 1972; hai cánh kiến trúc Pháp còn lại. Sau ngày thống nhất, ga Hàng Cỏ đổi tên thành ga Hà Nội và đại sảnh được xây lại theo kiến trúc mới.',
      '2026': 'Vẫn là nhà ga chính của Hà Nội, điểm xuất phát tàu Thống Nhất; tuyến metro số 3 có ga ngầm "Ga Hà Nội" ngay cạnh.',
      '2050': 'Nhà ga trở thành đầu mối giao thông kết hợp đường sắt quốc gia, metro và xe buýt điện, với khu thương mại phía trên.',
      '2100': 'Tàu cao tốc và metro tự hành chạy ngầm; mặt tiền 1902 còn lại được giữ như ký ức về thời kỳ đầu của đường sắt Việt Nam.',
    },
  },
};

/** Suggested questions with reviewed answers (same order as EN_QA). */
export const QA: ChatAnswer[] = [
  {
    q: 'Truyền thuyết Hồ Gươm là gì?',
    a: 'Tương truyền vua Lê Lợi mượn gươm thần để đánh đuổi giặc Minh; sau khi thắng trận, một con rùa vàng nổi lên giữa hồ đòi lại gươm — từ đó hồ được gọi là Hồ Hoàn Kiếm (trả gươm).',
    src: 'Nguồn: truyền thuyết dân gian, ghi chép trong các tư liệu lịch sử Hà Nội.',
    future: false,
  },
  {
    q: 'Ba Đình năm 1945 diễn ra sự kiện gì?',
    a: 'Ngày 2/9/1945, tại Quảng trường Ba Đình, Chủ tịch Hồ Chí Minh đọc bản Tuyên ngôn Độc lập, khai sinh nước Việt Nam Dân chủ Cộng hoà.',
    src: 'Nguồn: tư liệu lịch sử chính thức Việt Nam.',
    future: false,
  },
  {
    q: 'Hà Nội năm 2100 sẽ trông như thế nào?',
    a: 'Đây là kịch bản do AI hình dung: các khu di sản được bảo tồn dưới dạng "bảo tàng sống" với cảm biến khí hậu vi mô, trong khi các khu đô thị mới phát triển giao thông trên cao và không gian số hoá song song với không gian thật.',
    src: 'Đây là kịch bản tương lai do AI tạo ra — không phải dự đoán chắc chắn.',
    future: true,
  },
  {
    q: 'Phố Cổ có bao nhiêu tuyến phố nghề?',
    a: 'Khu Phố Cổ Hà Nội thường được gọi là "36 phố phường", mỗi phố xưa gắn với một nghề thủ công hoặc mặt hàng buôn bán riêng, như Hàng Bạc, Hàng Mã, Hàng Gai.',
    src: 'Nguồn: tư liệu lịch sử đô thị Hà Nội.',
    future: false,
  },
  {
    q: 'Chùa Một Cột bị phá năm nào?',
    a: 'Ngày 11/9/1954, trước khi rút khỏi Hà Nội, quân đội Pháp đặt mìn phá huỷ Chùa Một Cột. Năm 1955 chùa được dựng lại theo kiến trúc cũ — kiến trúc có từ năm 1049 thời vua Lý Thái Tông.',
    src: 'Nguồn: tư liệu lịch sử về di tích Chùa Một Cột (Diên Hựu tự).',
    future: false,
  },
  {
    q: 'Vì sao Hỏa Lò được gọi là "Hanoi Hilton"?',
    a: 'Giai đoạn 1964–1973, nhà tù Hỏa Lò giam giữ phi công Mỹ bị bắn rơi trên miền Bắc; họ đặt cho nơi này biệt danh mỉa mai "Hanoi Hilton". Phần còn lại của nhà tù nay là di tích – bảo tàng.',
    src: 'Nguồn: tư liệu lịch sử về di tích Nhà tù Hỏa Lò.',
    future: false,
  },
  {
    q: 'Cầu Long Biên được xây khi nào?',
    a: 'Cầu hoàn thành năm 1902 dưới tên cầu Paul Doumer, dài khoảng 1,7 km, từng là cây cầu duy nhất qua sông Hồng. Cầu bị ném bom nhiều lần năm 1967 và 1972 nhưng vẫn đứng vững đến nay.',
    src: 'Nguồn: tư liệu lịch sử giao thông Hà Nội.',
    future: false,
  },
];
