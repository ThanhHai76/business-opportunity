import { Source } from './career.data';

/**
 * The English version of the content in career.data.ts: the same facts, in the same order, with the same sources
 * (the sources themselves keep their Vietnamese titles). The data file stays the one place that holds the figures and
 * their citations; this file only holds the words. career.en.spec.ts checks that nothing is missing or out of step.
 */
export interface DirectionEn {
  name: string;
  blurb: string;
  facts: string[];
  roles: string[];
  skills: string[];
  /** [when, text] in the order of the Vietnamese steps. */
  steps: [string, string][];
  /** The labels of the tool links, in order. */
  tools: string[];
}

export const EN_DIRECTIONS: Record<string, DirectionEn> = {
  semiconductor: {
    name: 'High technology and semiconductors',
    blurb: 'Operating, testing and maintaining equipment, and production in factories and hi-tech parks.',
    facts: [
      'According to an estimate in the Q2 2026 forecast of the Hanoi Employment Service Center, Hanoi is short of about 50,000 high-quality workers, mostly in high technology, engineering and sustainable development.',
      "Plan 212/KH-UBND (2 June 2026) of the city's People's Committee aims to train at least 22,000 people with a university degree or higher for the semiconductor industry by 2030, and to set up at least one international technology university at the Hòa Lạc Hi-Tech Park.",
      'According to the Hanoi Employment Service Center (as reported in the press), semiconductor technicians commonly earn 15–25 million VND a month (for reference only; it varies with the role and experience).',
    ],
    roles: ['Equipment operation technician', 'Quality inspection technician', 'Electrical and electronics engineer', 'Process engineer'],
    skills: ['Basic electrical and electronics', 'Reading drawings and technical procedures', 'Technical English', 'Shift work and cleanroom standards'],
    steps: [
      ['Week 1', 'Decide whether you want to be a technician (vocational school or college) or an engineer (university): the paths differ.'],
      ['1–3 months', 'Learn the basics of electrical and electronics work and technical English; ask the employment service centre about related vocational courses.'],
      ['6–12 months', 'Look for an apprenticeship or internship at a factory or hi-tech park; follow job postings on the official job platforms.'],
    ],
    tools: ['See the Hòa Lạc plan and the technology zones', 'Find a place to live near work'],
  },
  engineering: {
    name: 'Engineering, manufacturing and construction',
    blurb: 'Electricians, mechanics, builders and finishing trades; site supervision; factory operation.',
    facts: [
      "Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in manufacturing and construction up by about 5%.",
      "Infrastructure and urban projects are one driver of Hanoi's demand for construction workers (according to press reports in July 2026).",
    ],
    roles: ['Electrician, mechanic, welder', 'Construction worker and team leader', 'Site supervisor', 'Machine operator'],
    skills: ['Certified trade skills', 'Occupational safety', 'Reading drawings', 'Team management (for supervisor roles)'],
    steps: [
      ['Week 1', 'Pick one specific trade (electrical, mechanical, welding, finishing…) rather than "construction" in general.'],
      ['1–3 months', 'Take a short vocational course for a certificate; if you have paid unemployment insurance, ask about vocational training support.'],
      ['3–6 months', 'Join a construction crew or factory through official job postings; small jobs can build experience.'],
    ],
    tools: ['See the infrastructure projects under construction', 'Open a workshop or technical service shop'],
  },
  logistics: {
    name: 'Transport and logistics',
    blurb: 'Warehouses, dispatch, delivery, fleet operation and import–export paperwork.',
    facts: [
      'Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in transport and logistics up by about 4%.',
      "Logistics is one of the service sectors the Capital Plan 2021–2030 aims to develop.",
    ],
    roles: ['Warehouse staff', 'Dispatch and delivery staff', 'Documentation staff', 'Driver, fleet manager'],
    skills: ['Warehouse and order management software', 'Excel', 'Basic business English', 'A suitable driving licence (for drivers)'],
    steps: [
      ['Week 1', 'Choose an area: warehouse, delivery, documentation or dispatch. Each needs different skills.'],
      ['1–3 months', 'Learn warehouse software and Excel; for documentation, learn the basics of import–export procedures.'],
      ['3–6 months', 'Apply as a staff member or warehouse assistant first, then move up to dispatch with experience.'],
    ],
    tools: ['See the transport axes and development poles'],
  },
  retail: {
    name: 'Retail, wholesale and customer care',
    blurb: 'Selling in stores and online, customer care, shift and store management.',
    facts: [
      'Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in wholesale and retail up by about 6%, the highest of the groups mentioned.',
      'In January 2026 Hanoi was expected to need about 40,000 workers, mostly in wholesale and retail, manufacturing, construction, and transport and logistics.',
    ],
    roles: ['Sales assistant', 'Customer care staff', 'Shift leader, store manager', 'Online seller'],
    skills: ['Communication and advising customers', 'Point-of-sale software, Excel', 'Online selling', 'Shift and stock management (for managers)'],
    steps: [
      ['Week 1', 'You can start right away: apply as a staff member; choose a chain or store that trains new hires.'],
      ['1–3 months', 'Learn online selling and point-of-sale software to improve your chances and income.'],
      ['6–12 months', 'Aim for shift leader or store manager; or consider opening a small shop yourself (see the Business Opportunity Map).'],
    ],
    tools: ['Which wards suit opening a shop'],
  },
  tourism: {
    name: 'Tourism, food and services',
    blurb: 'Restaurants, cafés, hotels, tour guiding and operation, personal services.',
    facts: [
      'Tourism, trade and services are sectors the Capital Plan 2021–2030 aims to develop.',
      'Trade–services and F&B are fields with large labour demand (according to press reports in July 2026).',
    ],
    roles: ['Waiter, barista, cook', 'Receptionist, housekeeper', 'Tour guide, tour operator', 'Restaurant or café manager'],
    skills: ['Service and communication', 'Conversational English', 'Food safety', 'Shift management (for managers)'],
    steps: [
      ['Week 1', 'You can start right away as a waiter, barista or receptionist.'],
      ['1–3 months', 'Learn conversational English and the relevant certificates (barista, food safety, tour guide).'],
      ['6–12 months', 'Move up to shift manager; or open a small place once you understand operations — see which wards suit this sector in the Business Opportunity Map.'],
    ],
    tools: ['Which wards suit opening a café or restaurant', 'Explore Hanoi, then and now'],
  },
  finance: {
    name: 'Finance, banking, insurance and the digital economy',
    blurb: 'Accounting, credit, insurance advice, data analysis, e-commerce operations and digital products.',
    facts: [
      "Finance, banking, insurance and the digital economy are part of the service-sector direction of the Capital Plan 2021–2030.",
      'Hanoi is short of high-quality workers; employers prefer staff with specialist skills (according to press reports in July 2026).',
    ],
    roles: ['Accountant, auditor', 'Credit officer, insurance adviser', 'Data analyst', 'E-commerce operations'],
    skills: ['Accounting and advanced Excel', 'Basic data analysis', 'Professional certificates (accounting, insurance…)', 'English'],
    steps: [
      ['Week 1', 'Choose an area: accounting, credit/insurance, or data and e-commerce.'],
      ['1–3 months', 'Learn advanced Excel and the basics of your chosen area; get a professional certificate where needed.'],
      ['6–12 months', 'Apply as an assistant or intern; build a portfolio with real work (an analysis, a sample report).'],
    ],
    tools: ['See the plan for the financial and service centres'],
  },
  self: {
    name: 'Starting a small business',
    blurb: 'Opening a café, shop or small service, starting with modest capital.',
    facts: [
      'This page has no statistics on self-employment. The Business Opportunity Map scores 12 sectors across 79 wards and communes from OpenStreetMap data, with a feasibility calculator for your own numbers.',
    ],
    roles: ['Café or restaurant owner', 'Convenience or grocery store owner', 'Beauty, laundry or vehicle-repair services', 'Online seller'],
    skills: ['Costs and cash flow', 'Choosing a location', 'Managing staff and stock', 'Basic marketing'],
    steps: [
      ['Week 1', 'Pick a sector and try out the profit and loss with the feasibility calculator, using your own numbers.'],
      ['1–3 months', 'Visit a few high-scoring wards; ask for real rents; try on a small scale.'],
      ['6–12 months', 'Open with capital you can afford to risk; keep other income during the first period.'],
    ],
    tools: ['Open the Business Opportunity Map'],
  },
};

/** The four figures of the general picture: [value, label]. */
export const EN_CONTEXT: [string, string][] = [
  ['8.67%', 'of young people aged 15–24 unemployed, Q2 2026 (nationwide)'],
  ['9.75%', 'for the same age group in urban areas'],
  ['≈ 1.4 million', 'young people aged 15–24 not in employment, education or training (10.0%)'],
  ['2.22%', 'overall unemployment rate, first six months of 2026 (nationwide)'],
];

export const EN_SIGNALS: Record<string, string> = {
  semiconductor: 'According to the Q2 2026 forecast of the Hanoi Employment Service Center, the city is short of about 50,000 high-quality workers, mostly in high technology and engineering.',
  engineering: 'Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in manufacturing and construction up by about 5%.',
  logistics: 'Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in transport and logistics up by about 4%.',
  retail: 'Forecast of the Hanoi Employment Service Center (January 2026): hiring demand in wholesale and retail up by about 6%, the highest of the groups mentioned.',
  tourism: 'Tourism, trade and services are in the plan\'s direction; F&B has large labour demand (press, July 2026).',
  finance: 'Finance, banking, insurance and the digital economy are in the plan\'s direction; employers prefer specialist staff.',
  self: 'No statistics here; see each ward\'s opportunity score and the feasibility calculator in the Business Opportunity Map.',
};

/** [title, text] of each policy, in order. */
export const EN_POLICIES: [string, string][] = [
  ['Four unemployment insurance benefits', 'Career counselling and job referral; support for training and upskilling; the unemployment allowance; support for employers who train staff to keep jobs.'],
  ['Unemployment allowance', 'Each month, 60% of the average salary on which unemployment insurance was paid over the last 6 months, up to 5 times the regional minimum wage. 12 to under 36 months of contributions give 3 months of allowance; each further 12 months of contributions add 1 month, up to 12 months.'],
  ['Waiting time', 'From 1 January 2026 the agency decides within 10 working days of receiving a complete application; the allowance runs from the 11th working day (Articles 38 and 39 of the Employment Law 2025).'],
  ['Training support', 'People receiving the unemployment allowance can get vocational training support for up to 6 months, covering tuition and meals (Article 37). Ask the employment service centre about the current conditions and amounts.'],
];

/** The text of each job channel, in order (the names are proper names and stay as they are). */
export const EN_CHANNELS: { name: string; text: string }[] = [
  { name: 'National Job Exchange (Sàn giao dịch việc làm quốc gia)', text: 'Run by the Ministry of Home Affairs; it connects workers and employers nationwide, and job seekers\' details are verified through VNeID electronic identity.' },
  { name: 'Hanoi city job portal (Cổng việc làm thành phố Hà Nội)', text: 'Run by the Hanoi Employment Service Center; launched in December 2025.' },
];

export const EN_LANDMARK = 'A reference point used to compute travel times, not a list of employers.';

/** [name, note] of each area, by id. The landmark areas share EN_LANDMARK. */
export const EN_AREAS: Record<string, [string, string]> = {
  centre: ['Central area (around Hoàn Kiếm Lake)', EN_LANDMARK],
  offices: ['Cầu Giấy – Duy Tân office area', EN_LANDMARK],
  airport: ['Nội Bài Airport', EN_LANDMARK],
  bac: ['Northern pole: Đông Anh – Mê Linh – Sóc Sơn', 'Plan: international services, trade, finance and logistics tied to Nội Bài airport and high-tech industry.'],
  dong: ['Eastern pole: Gia Lâm – Long Biên', 'Plan: eastern gateway with trade, services and modern logistics along National Road 5 and the Hanoi – Hải Phòng expressway.'],
  'thuong-tin-phu-xuyen': ['Southern pole: Thường Tín – Phú Xuyên', 'Plan: industry, logistics and a multimodal transport hub tied to the southern airport and the high-speed railway.'],
  'xuan-mai': ['South-western pole: Xuân Mai – Chương Mỹ', 'Plan: education and training, healthcare and eco-tourism.'],
  'hoa-lac': ['Western pole: Hòa Lạc', 'Plan: a science and technology city for innovation (Hi-Tech Park, Vietnam National University).'],
  'son-tay-ba-vi': ['North-western pole: Sơn Tây – Ba Vì', 'Plan: a cultural and historic city, and tourism.'],
  'song-hong': ['Red River space pole', 'Plan: a special landscape pole with finance, trade, services and tourism.'],
};

/** An English gloss for the one source whose title describes a method rather than naming a document. */
export const EN_SOURCE_TITLES: Record<string, string> = {
  osrm: 'Driving times computed with OSRM on the OpenStreetMap road network (free-flowing roads, traffic not included)',
};

export const EN_SOURCE_KIND: Record<Source['kind'], string> = {
  official: 'official document or statistic',
  press: 'press report',
  computed: 'figures computed from open data',
};

export const EN_SITUATIONS: Record<string, string> = {
  unemployed: 'Unemployed',
  switching: 'Want to change careers',
  graduate: 'Recent graduate',
  employed: 'Working, looking at the job market',
};
export const EN_EDUCATIONS = ['Secondary school', 'Vocational school or college', 'University or higher'];
export const EN_TIMES = ['Need to start now', 'A few months to train', 'A year or more'];
export const EN_WORKS: Record<string, string> = { employee: 'Employee', self: 'Self-employed', either: 'Either is fine' };
export const EN_BACKGROUNDS: Record<string, string> = {
  tech: 'technology, electrical–electronics',
  engineering: 'engineering, mechanics, construction',
  sales: 'sales, customer care',
  logistics: 'warehousing, transport, delivery',
  service: 'restaurants, hotels, tourism',
  finance: 'accounting, finance, banking',
  other: 'another field',
};
export const EN_TRAIN = ['start right away', 'a few months', 'a year or more'];
export const EN_EDU = ['secondary school', 'vocational school or college', 'university or higher'];
