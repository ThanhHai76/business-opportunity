import type { SiteLang } from '../../services/site-lang.service';

export interface GuideTerm {
  name: string;
  means: string;
  detail?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  lead: string;
  terms: GuideTerm[];
  example?: string;
  link?: { path: string; label: string };
}

export interface GuideText {
  title: string;
  intro: string;
  readingTitle: string;
  reading: string[];
  sections: GuideSection[];
  limitsTitle: string;
  limits: string[];
  home: string;
  tocLabel: string;
}

/**
 * The scores of the three tools in plain words. The numbers (weights, formula, bands) are the ones the servers use:
 * backend-node/src/opportunity (METHOD), property-intel/model.js (CRITERIA), living-score/scoring/criteria.js.
 */
export const GUIDE_TEXT: Record<SiteLang, GuideText> = {
  vi: {
    title: 'Điểm số nghĩa là gì?',
    intro: 'Ba công cụ của Hanoi Century Vista đều cho điểm từ 0 đến 100. Trang này giải thích bằng lời thường: điểm đo cái gì, tính thế nào, và đừng hiểu nó như thế nào.',
    readingTitle: 'Cách đọc mọi điểm số',
    reading: [
      'Điểm là so sánh giữa các phường/xã với nhau, không phải điểm tuyệt đối. 100 nghĩa là cao nhất trong số các phường được chấm; 50 là ở giữa.',
      'Điểm cao không bảo đảm có lời hay nên mua. Điểm giúp bạn biết nên xem phường nào trước, rồi đi khảo sát thực tế.',
      'Mỗi điểm đều dựa trên dữ liệu có nguồn (chủ yếu OpenStreetMap, danh sách và dân số chính thức). Chỗ nào dữ liệu ít, chúng tôi ghi rõ "chỉ tham khảo".',
    ],
    sections: [
      {
        id: 'opportunity',
        title: 'Điểm cơ hội (Mở gì ở đâu)',
        lead: 'Trả lời: ở phường này, mở loại hình kinh doanh này thì thuận lợi tới đâu so với các phường khác.',
        terms: [
          { name: 'Nhu cầu', means: 'Có nhiều người cần loại hình này không.', detail: 'Tính từ dân số và các nơi kéo khách (văn phòng, chung cư, trường học, ga metro). Mỗi ngành coi trọng một loại khác nhau: quán cà phê chú ý văn phòng, giáo dục trẻ em chú ý trường học.' },
          { name: 'Cạnh tranh', means: 'Đã có bao nhiêu cơ sở cùng loại.', detail: 'Là số cơ sở cùng ngành trên 10.000 dân. Càng nhiều cơ sở trên mỗi người dân thì càng khó.' },
          { name: 'Cơ hội', means: 'Nhu cầu trừ đi một phần cạnh tranh.', detail: 'Cơ hội = nhu cầu − 0,4 × cạnh tranh. Cạnh tranh làm giảm điểm, nhưng ít hơn nhu cầu làm tăng điểm.' },
          { name: 'Dữ liệu ít, chỉ tham khảo', means: 'Bản đồ ghi nhận chưa đủ cơ sở ở phường này.', detail: 'OpenStreetMap do cộng đồng đóng góp nên thiếu nhiều cửa hàng nhỏ. Khi thấy nhãn này, mức cạnh tranh có thể đang bị đánh giá thấp.' },
          { name: 'Mốc 2030', means: 'Thêm tín hiệu tăng trưởng.', detail: 'Cộng công trình đang xây trong phường và tuyến metro đang thi công gần đó. Đây là tín hiệu, không phải dự báo.' },
        ],
        example: 'Ví dụ: nhu cầu 80, cạnh tranh 50 thì cơ hội = 80 − 0,4 × 50 = 60.',
        link: { path: '/opportunity-map', label: 'Mở bản đồ Mở gì ở đâu' },
      },
      {
        id: 'living',
        title: 'Điểm đáng sống (Living Score)',
        lead: 'Trả lời: sống ở khu vực này tiện tới đâu. Bạn tự chỉnh mức quan trọng của từng tiêu chí.',
        terms: [
          { name: 'Giao thông (25)', means: 'Ga metro đang chạy và điểm xe buýt trong 1,5 km.' },
          { name: 'Giáo dục (20)', means: 'Trường học, mầm non, cơ sở đào tạo trong 1,5 km.' },
          { name: 'Y tế (15)', means: 'Bệnh viện và phòng khám trong 1,5 km.' },
          { name: 'Không gian xanh (15)', means: 'Phần diện tích là công viên và hồ trong 1,5 km.' },
          { name: 'Tiện ích (25)', means: 'Siêu thị, cửa hàng tiện lợi, chợ, trung tâm thương mại, quán cà phê trong 1,5 km.' },
          { name: 'Các mức điểm', means: 'Từ 75: rất đáng sống. Từ 65: đáng sống. Từ 50: trung bình. Dưới 50: cần cân nhắc.', detail: 'Số trong ngoặc là mức quan trọng mặc định (tổng 100). Bạn có thể đổi.' },
          { name: 'Chưa chấm', means: 'An ninh, môi trường, chi phí.', detail: 'Chưa có dữ liệu mở đáng tin theo khu vực nên chúng tôi không đoán mà để trống.' },
        ],
        link: { path: '/living-score', label: 'Mở Điểm đáng sống' },
      },
      {
        id: 'property',
        title: 'Điểm tiềm năng bất động sản',
        lead: 'Trả lời: phường này có những điều kiện nào để phát triển trong những năm tới, so với các phường khác.',
        terms: [
          { name: 'Kết nối metro và xe buýt (25%)', means: 'Gần ga metro đang chạy và nhiều điểm xe buýt.', detail: '70% từ khoảng cách tới ga gần nhất, 30% từ mật độ điểm xe buýt.' },
          { name: 'Hạ tầng sắp có (25%)', means: 'Metro, cầu, vành đai đang xây hoặc trong quy hoạch ở gần.', detail: 'Công trình đang thi công được tính nhiều hơn công trình mới trong quy hoạch.' },
          { name: 'Cực phát triển (15%)', means: 'Gần các cực phát triển của Quyết định 2512.' },
          { name: 'Tiện ích đô thị (15%)', means: 'Trường học, y tế, mua sắm, công viên trên mỗi km².' },
          { name: 'Mật độ dân cư (10%)', means: 'Đông dân tức là có nhu cầu; đây không phải chỉ số "đáng sống".' },
          { name: 'Phát triển mới (10%)', means: 'Công trường đang xây và nhiều chung cư mới trên mỗi km².' },
        ],
        example: 'Tỷ lệ phần trăm là mức quan trọng mặc định; bạn có thể kéo để đổi và xếp hạng tính lại ngay. Phường thiếu số liệu dân cư được chấm trên các tiêu chí còn lại.',
        link: { path: '/property-intelligence', label: 'Mở Chấm điểm bất động sản' },
      },
    ],
    limitsTitle: 'Điều điểm số không nói',
    limits: [
      'Không dự báo doanh thu, giá nhà hay lợi nhuận.',
      'Không thay cho khảo sát thực địa và tư vấn pháp lý, tài chính.',
      'Có thể sai nếu dữ liệu nguồn thiếu hoặc cũ. Thấy số liệu sai, hãy bấm "Báo sai số liệu" ở từng phường hoặc nguồn.',
    ],
    home: 'Trang chủ',
    tocLabel: 'Mục lục',
  },
  en: {
    title: 'What do the scores mean?',
    intro: 'All three tools of Hanoi Century Vista score from 0 to 100. This page explains in plain words what a score measures, how it is worked out, and how not to read it.',
    readingTitle: 'How to read any score',
    reading: [
      'A score compares wards and communes with each other; it is not an absolute grade. 100 is the highest among the wards scored; 50 is in the middle.',
      'A high score does not promise a profit or a good purchase. It tells you which wards to look at first, then you go and see for yourself.',
      'Every score rests on sourced data (mostly OpenStreetMap and the official list and population). Where data is thin we say "indicative only".',
    ],
    sections: [
      {
        id: 'opportunity',
        title: 'Opportunity score (Business Opportunity Map)',
        lead: 'Answers: in this ward, how favourable is this kind of business compared with other wards?',
        terms: [
          { name: 'Demand', means: 'Do many people need this kind of business?', detail: 'Worked out from population and the places that bring customers (offices, apartment buildings, schools, metro stations). Each business type cares about different ones: a café looks at offices, children\'s education looks at schools.' },
          { name: 'Competition', means: 'How many of the same kind are already there?', detail: 'Businesses of the same type per 10,000 residents. More per resident means harder.' },
          { name: 'Opportunity', means: 'Demand minus a part of competition.', detail: 'Opportunity = demand − 0.4 × competition. Competition lowers the score, but less than demand raises it.' },
          { name: 'Little data, indicative only', means: 'The map has not recorded enough businesses in this ward.', detail: 'OpenStreetMap is volunteer-built and misses many small shops. With this label, competition may be under-counted.' },
          { name: 'Horizon 2030', means: 'Adds a growth signal.', detail: 'Adds construction sites in the ward and metro being built nearby. A signal, not a forecast.' },
        ],
        example: 'Example: demand 80, competition 50 gives opportunity = 80 − 0.4 × 50 = 60.',
        link: { path: '/opportunity-map', label: 'Open the Business Opportunity Map' },
      },
      {
        id: 'living',
        title: 'Living Score',
        lead: 'Answers: how convenient is life in this area? You set how much each criterion matters.',
        terms: [
          { name: 'Transportation (25)', means: 'Metro stations in service and bus stops within 1.5 km.' },
          { name: 'Education (20)', means: 'Schools, kindergartens and colleges within 1.5 km.' },
          { name: 'Healthcare (15)', means: 'Hospitals and clinics within 1.5 km.' },
          { name: 'Green space (15)', means: 'Share of parks and lakes within 1.5 km.' },
          { name: 'Amenities (25)', means: 'Supermarkets, convenience stores, markets, malls and cafés within 1.5 km.' },
          { name: 'The bands', means: 'From 75: very liveable. From 65: liveable. From 50: average. Below 50: think twice.', detail: 'The number in brackets is the default weight (they add up to 100). You can change them.' },
          { name: 'Not scored', means: 'Safety, environment, cost.', detail: 'There is no reliable open data per area, so we leave them empty instead of guessing.' },
        ],
        link: { path: '/living-score', label: 'Open Living Score' },
      },
      {
        id: 'property',
        title: 'Property potential score',
        lead: 'Answers: what does this ward have going for it in the coming years, compared with other wards?',
        terms: [
          { name: 'Metro and bus access (25%)', means: 'Near a metro station in service and many bus stops.', detail: '70% from the distance to the nearest station, 30% from the density of bus stops.' },
          { name: 'Infrastructure coming (25%)', means: 'Metro, bridges and ring roads being built or planned nearby.', detail: 'Works under construction count more than ones only in the plan.' },
          { name: 'Growth pole (15%)', means: 'Near the growth poles of Decision 2512.' },
          { name: 'Urban amenities (15%)', means: 'Schools, health, shopping and parks per km².' },
          { name: 'Population density (10%)', means: 'More people means more demand; this is not a livability measure.' },
          { name: 'New development (10%)', means: 'Construction sites and new apartment buildings per km².' },
        ],
        example: 'The percentages are the default weights; drag them and the ranking is worked out again at once. A ward without a population figure is scored on the other criteria.',
        link: { path: '/property-intelligence', label: 'Open AI Property Intelligence' },
      },
    ],
    limitsTitle: 'What a score does not say',
    limits: [
      'It does not forecast revenue, house prices or profit.',
      'It does not replace a visit to the street, nor legal or financial advice.',
      'It can be wrong when the source data is missing or old. If you see a wrong figure, press "Report a data error" on the ward or source.',
    ],
    home: 'Home',
    tocLabel: 'Contents',
  },
};
