'use strict';
/**
 * What the 100-year plan (QĐ 2512/QĐ-UBND, 13/5/2026) says in words, beside the map: its viewpoint, the goal of each
 * milestone and two topics (the historic centre, the economy). Shown by the "Quy hoạch nói gì" panel.
 *
 * Only statements found in at least two of the sources listed in data.js are kept, and each item lists the ids of those
 * sources. A figure found in one source only is left out (the GRDP per person, the share of the digital economy, the
 * underground-space targets): the full text of the decision was not available when this was written, so the rule is
 * "two readings agree". Text is bilingual ({ vi, en }).
 */

const VIEWPOINT = [
  {
    id: 'people',
    text: {
      vi: 'Xây dựng Thủ đô “Văn hiến – Văn minh – Hiện đại – Hạnh phúc”, lấy con người làm trung tâm.',
      en: 'Build the Capital as “cultured, civilised, modern and happy”, with people at the centre.',
    },
    sources: ['qd2512Gov', 'qd2512NhanDan'],
  },
  {
    id: 'structure',
    text: {
      vi: 'Cấu trúc “đa tầng, đa lớp, đa cực, đa trung tâm”: 9 cực phát triển, 9 trung tâm lớn, 9 trục động lực; sông Hồng là trục cảnh quan sinh thái – văn hoá chủ đạo.',
      en: 'A “multi-layer, multi-pole, multi-centre” structure: 9 development poles, 9 large centres and 9 dynamic axes, with the Red River as the main ecological and cultural landscape axis.',
    },
    sources: ['qd2512Gov', 'qd2512NhanDan'],
  },
  {
    id: 'vision',
    text: {
      vi: 'Tầm nhìn 100 năm: một thành phố toàn cầu “Văn hiến – Thông minh – Sáng tạo – Sinh thái”, thuộc nhóm thủ đô có chất lượng sống và hạnh phúc cao.',
      en: 'The 100-year vision: a global city that is “cultured, smart, creative and ecological”, among the capitals with a high quality of life and happiness.',
    },
    sources: ['qd2512NhanDan', 'qd2512PhapLuat'],
  },
];

/** Goal and headline economic size of each milestone (the years are the ones of the timeline in data.js). */
const MILESTONES = [
  {
    year: 2035,
    goal: {
      vi: 'Đô thị xanh, thông minh, hiện đại; có các trung tâm giáo dục – đào tạo và y tế chất lượng cao thuộc nhóm dẫn đầu châu Á – Thái Bình Dương.',
      en: 'A green, smart, modern city, with high-quality education and health centres among the leaders of Asia-Pacific.',
    },
    goalSources: ['qd2512Gov', 'qd2512Targets'],
    grdp: { vi: 'Quy mô GRDP khoảng 200 tỷ USD', en: 'GRDP of about USD 200 billion' },
    grdpSources: ['qd2512Targets', 'qd2512NhanDan'],
  },
  {
    year: 2045,
    goal: {
      vi: 'Trung tâm đổi mới sáng tạo quan trọng của khu vực châu Á – Thái Bình Dương.',
      en: 'An important innovation centre of the Asia-Pacific region.',
    },
    goalSources: ['qd2512Gov', 'qd2512Targets'],
    grdp: { vi: 'Quy mô GRDP khoảng 640 tỷ USD', en: 'GRDP of about USD 640 billion' },
    grdpSources: ['qd2512Targets', 'qd2512NhanDan', 'qd2512PhapLuat'],
  },
  {
    year: 2065,
    goal: {
      vi: 'Thành phố toàn cầu, phát triển cao và bền vững, thuộc nhóm thủ đô có chất lượng sống cao.',
      en: 'A global city, highly and sustainably developed, among the capitals with a high quality of life.',
    },
    goalSources: ['qd2512Gov', 'qd2512Targets'],
    grdp: { vi: 'Quy mô GRDP khoảng 1.920 tỷ USD', en: 'GRDP of about USD 1,920 billion' },
    grdpSources: ['qd2512Targets', 'qd2512Grdp'],
  },
  {
    year: 2085,
    goal: {
      vi: 'Một trong những trung tâm có tầm ảnh hưởng lớn trong mạng lưới thành phố khu vực và toàn cầu; siêu đô thị bền vững tiêu biểu. Dân số giữ ổn định, tối đa khoảng 20 triệu người.',
      en: 'One of the centres with great influence in the regional and global network of cities; a model sustainable megacity. The population stays stable, at most about 20 million.',
    },
    goalSources: ['qd2512Gov', 'qd2512Grdp', 'qd2512Targets'],
    grdp: null,
    grdpSources: [],
  },
];

const TOPICS = [
  {
    id: 'heritage',
    title: { vi: 'Nội đô lịch sử', en: 'The historic centre' },
    items: [
      {
        text: {
          vi: 'Bảo tồn Hồ Gươm, phố Cổ, phố Cũ, Hồ Tây, Hoàng thành Thăng Long, Văn Miếu – Quốc Tử Giám.',
          en: 'Conserve Hoàn Kiếm Lake, the Old Quarter, the French Quarter, West Lake, the Thăng Long Imperial Citadel and the Temple of Literature.',
        },
        sources: ['qd2512Congthuong', 'qd2512Gov'],
      },
      {
        text: {
          vi: 'Giảm mật độ xây dựng ở khu vực trung tâm, ưu tiên đất cho công viên và cây xanh.',
          en: 'Reduce building density in the central area and give priority to land for parks and greenery.',
        },
        sources: ['qd2512Congthuong', 'qd2512Gov'],
      },
    ],
  },
  {
    id: 'economy',
    title: { vi: 'Kinh tế và đổi mới sáng tạo', en: 'Economy and innovation' },
    items: [
      {
        text: {
          vi: 'Hòa Lạc là hạt nhân của hệ sinh thái đổi mới sáng tạo (hướng tới đô thị khoa học công nghệ Hòa Lạc).',
          en: 'Hòa Lạc is the core of the innovation ecosystem (towards a Hòa Lạc science and technology city).',
        },
        sources: ['qd2512Gov', 'qd2512NhanDan'],
      },
      {
        text: {
          vi: 'Ưu tiên thu hút đầu tư vào chip bán dẫn, trí tuệ nhân tạo, logistics và công nghệ số.',
          en: 'Priority for investment in semiconductors, artificial intelligence, logistics and digital technology.',
        },
        sources: ['qd2512Gov', 'qd2512NhanDan'],
      },
      {
        text: {
          vi: 'Khu thương mại tự do, gắn với đô thị sân bay phía Bắc.',
          en: 'A free trade zone, tied to the northern airport city.',
        },
        sources: ['qd2512Gov', 'qd2512NhanDan', 'qd2512PhapLuat'],
      },
    ],
  },
];

module.exports = { VIEWPOINT, MILESTONES, TOPICS };
