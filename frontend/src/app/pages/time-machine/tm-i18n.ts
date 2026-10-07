/**
 * English version of the Time Machine's content. Vietnamese stays the source text (in the component,
 * landmark-info.ts, landmark-tours.ts and time-machine-photos.ts); everything here is a translation of it
 * and adds no facts. Static page text is translated in the template with data-en attributes.
 *
 * backend-node/scripts/sync-time-machine.js reads EN_LANDMARKS and EN_EVENTS too, so the AI Storyteller
 * can answer in English — run `npm run sync:time-machine` after editing them.
 */
export type Lang = 'vi' | 'en';
export const LANG_KEY = 'hanoi100.tm.lang';

export const EN_ERAS: Record<string, { label: string; tag: string }> = {
  '1926': { label: 'French colonial era', tag: 'HISTORICAL RECORD' },
  '1954': { label: 'Liberation of the capital', tag: 'HISTORICAL RECORD' },
  '1975': { label: 'National reunification', tag: 'HISTORICAL RECORD' },
  '2026': { label: 'Present day', tag: 'PRESENT' },
  '2050': { label: 'Future scenario', tag: 'FUTURE SCENARIO' },
  '2100': { label: 'Speculative scenario', tag: 'FUTURE SCENARIO' },
};

export const EN_LANDMARKS: Record<string, { name: string; sub: string; stories: Record<string, string> }> = {
  'hoan-kiem': {
    name: 'Hoan Kiem Lake',
    sub: 'Sword Lake & Turtle Tower',
    stories: {
      '1926': 'Under French rule, Hoan Kiem Lake marked the line between the Paris-style French Quarter to the south and the busy trading streets of the Old Quarter to the north. Turtle Tower had stood there since 1886.',
      '1954': 'On 10 October 1954 the liberation army marched through the streets around the lake on the day Hanoi was freed from French colonial rule — one of the most photographed moments in the city’s modern history.',
      '1975': 'After reunification the lake became the symbolic public space of the capital of a unified Vietnam, the setting for large rallies.',
      '2026': 'The weekend pedestrian zone around the lake draws tens of thousands of people, and amid modern city life the legend of King Lê Lợi returning the magic sword to the golden turtle is still retold every day.',
      '2050': 'The lake is protected inside a car-free “heritage core”, ringed by elevated walkways linked to the whole Old Quarter.',
      '2100': 'Turtle Tower is digitised into a mixed-reality anchor where visitors can “meet” historical figures recreated by AI on the spot.',
    },
  },
  'old-quarter': {
    name: 'Old Quarter',
    sub: '36 guild streets',
    stories: {
      '1926': 'The 36 streets still kept the old custom of one trade per street — from Hàng Bạc (silver) to Hàng Mã (votive paper) — though French architecture had begun to appear among the traditional tube houses.',
      '1954': 'After liberation many private shops gradually changed their business model, and the Old Quarter entered a period of collective economy, quieter than in colonial times.',
      '1975': 'In the subsidy era the Old Quarter became one of the most crowded neighbourhoods of Hanoi; many tube houses were split up and shared by several families.',
      '2026': 'The Old Quarter is both living heritage and Hanoi’s busiest tourist destination — weekend walking streets and cafés in century-old tube houses, amid the highest population density in the city.',
      '2050': 'Historic façades are kept intact under strict conservation rules, while the back of each tube house is renovated with modular construction to raise living standards.',
      '2100': 'The whole Old Quarter becomes a “living museum” watched over by micro-climate sensors that adjust conditions automatically to protect heritage materials from climate change.',
    },
  },
  'ba-dinh': {
    name: 'Ba Dinh Square',
    sub: 'Quảng trường Ba Đình',
    stories: {
      '1926': 'In the French era Ba Đình was the administrative and residential quarter of the Indochina government, laid out in Western style with wide boulevards and the imposing Governor-General’s Palace.',
      '1954': 'After the capital was liberated, Ba Đình changed from the seat of colonial power into the political centre of the Democratic Republic of Vietnam.',
      '1975': 'The square is bound up with 2 September 1945 — when President Hồ Chí Minh read the Declaration of Independence here — and went on hosting the major events of the reunified country.',
      '2026': 'The daily flag-raising and flag-lowering ceremonies still draw crowds of residents and visitors; the Hồ Chí Minh Mausoleum stands at the heart of the area.',
      '2050': 'The area around the square gains green space and public transport, with private vehicles restricted to protect the ceremonial landscape.',
      '2100': 'National ceremonies are broadcast as mixed-reality experiences, letting Vietnamese people all over the world be “present” in the square at the same time.',
    },
  },
  'van-mieu': {
    name: 'Temple of Literature',
    sub: 'Văn Miếu · founded 1070',
    stories: {
      '1926': 'Under the French, the Temple of Literature – Imperial Academy no longer held examinations (the mandarin exams were abolished in 1919), but it remained a symbol of Confucian learning in a Hanoi that was becoming Westernised.',
      '1954': 'After liberation the new government took over the site, which began to be seen again as national educational heritage worth preserving, though restoration was limited by the war.',
      '1975': 'The temple was gradually restored as a symbol of the unified nation’s love of learning, welcoming students who came to “ask for calligraphy” before every exam.',
      '2026': 'The 82 Doctors’ steles (UNESCO Memory of the World) are a must for students before exam season and for international visitors learning about Vietnam’s examination tradition.',
      '2050': 'The steles are scanned in high-resolution 3D, so the ancient inscriptions can be studied remotely without touching the originals.',
      '2100': 'A complete “digital twin” of the temple exists alongside it, letting future generations “step into” the old examination grounds however the original changes.',
    },
  },
  'opera-house': {
    name: 'Hanoi Opera House',
    sub: 'Nhà Hát Lớn · 1911',
    stories: {
      '1926': 'Completed in 1911 in Beaux-Arts style, the Opera House was where the French and local elite enjoyed opera and theatre — a symbol of the ambition to turn Hanoi into a “little Paris”.',
      '1954': 'After liberation it hosted important political and cultural events of the new government, turning from an elite entertainment venue into a public space.',
      '1975': 'Through the years of reunification it remained the country’s leading performing-arts stage, though its facilities had deteriorated badly after the war.',
      '2026': 'After several restorations the Opera House is Hanoi’s top venue for concerts, opera and prestige events — old French architecture amid the modern buildings around it.',
      '2050': 'The historic interior is fully digitised, allowing “revival” shows of famous early-20th-century artists and acts as holograms on the original stage.',
      '2100': 'The Opera House becomes a meeting point of live performance and a global virtual audience, with the original architectural acoustics preserved absolutely.',
    },
  },
  'mot-cot': {
    name: 'One Pillar Pagoda',
    sub: 'Chùa Một Cột · 1049',
    stories: {
      '1926': 'The lotus-shaped pagoda on a single stone pillar in a square pond, built in 1049 under King Lý Thái Tông, stood quietly beside the French administrative mansions of Ba Đình.',
      '1954': 'On 11 September 1954, before withdrawing from Hanoi, the French army mined and destroyed the pagoda. In 1955 it was rebuilt to its original design.',
      '1975': 'The pagoda stands right beside the Hồ Chí Minh Mausoleum, inaugurated in 1975, and became part of the Ba Đình relic complex.',
      '2026': 'One of Hanoi’s most distinctive architectural symbols, and a familiar stop for visitors to the Mausoleum – Presidential Palace complex.',
      '2050': 'Its timber frame and stone pillar are monitored by humidity and vibration sensors; the pond and its surroundings are restored according to old records.',
      '2100': 'A digital twin lets visitors “step onto” the lotus platform and watch both the building of 1049 and the rebuilding of 1955.',
    },
  },
  'hoang-thanh': {
    name: 'Imperial Citadel of Thang Long',
    sub: 'Hoàng thành · Flag Tower 1812',
    stories: {
      '1926': 'Most of the Hanoi citadel had been pulled down by the French in the late 19th century to make room for barracks; what remained were Đoan Môn gate, Hậu Lâu, the North Gate and the Hanoi Flag Tower, built in 1812.',
      '1954': 'After the takeover of the capital the old citadel became the workplace of the Ministry of Defence — a military area closed to the public.',
      '1975': 'From House D67 and the command bunker inside the citadel, the Politburo and the Central Military Commission followed and directed the campaigns up to the Spring of 1975.',
      '2026': 'The central sector of the citadel was inscribed as a UNESCO World Heritage Site in 2010; the archaeological site at 18 Hoàng Diệu reveals traces of many dynasties layered on top of each other.',
      '2050': 'The archaeological layers are excavated further and displayed under transparent roofs, letting visitors look down through many layers of history on the spot.',
      '2100': 'The whole Thăng Long capital across the dynasties is rebuilt digitally; visitors pick a century and “walk” through palaces that have disappeared.',
    },
  },
  'long-bien': {
    name: 'Long Bien Bridge',
    sub: 'Cầu Long Biên · 1902',
    stories: {
      '1926': 'Named Paul Doumer Bridge, completed in 1902 and about 1.7 km long, it was then the only bridge across the Red River, carrying trains, rickshaws and pedestrians.',
      '1954': 'In October 1954 the last French units withdrew across the bridge to the other bank; the bridge was renamed Long Biên Bridge.',
      '1975': 'The bridge was bombed many times in 1967 and 1972; several spans were brought down but were repaired again and again to keep the north–south link open.',
      '2026': 'Open only to trains, motorbikes, bicycles and pedestrians, it has become a witness of history and a spot for watching the sunset over the Red River and its sandbank.',
      '2050': 'The bridge is strengthened while keeping its old steel form; both ends become riverside public spaces with walkways along the Red River green corridor.',
      '2100': 'The bridge becomes an open-air museum spanning the river, where each steel span tells a chapter of history in augmented reality.',
    },
  },
  'nha-tho-lon': {
    name: 'St. Joseph’s Cathedral',
    sub: 'Nhà thờ Lớn · 1886',
    stories: {
      '1926': 'Inaugurated at Christmas 1886 and built in Gothic style on the site of the old Báo Thiên pagoda, its twin bell towers were the landmark of the streets around Hoan Kiem Lake.',
      '1954': 'After the Geneva Accords many northern Catholics migrated south; the cathedral remained the centre of the Archdiocese of Hanoi.',
      '1975': 'In the years after reunification masses went on; the weathered façade became a familiar image of subsidy-era Hanoi.',
      '2026': 'Packed every Christmas; around the cathedral are pavement “lemon tea” stalls and cafés — a lively corner of modern Hanoi.',
      '2050': 'The square in front of the cathedral becomes a pedestrian space; its stone and stained glass are restored with the help of 3D scanning.',
      '2100': 'The original sound of its bells and hymns is archived digitally and played back on festival nights of light on the old façade.',
    },
  },
  'tran-quoc': {
    name: 'West Lake & Tran Quoc Pagoda',
    sub: 'Hồ Tây · a pagoda over 1,400 years old',
    stories: {
      '1926': 'West Lake covered more than 500 ha, ringed by fishing and flower villages; Trấn Quốc pagoda — with a history going back to the 6th century — stood on a small island linked to the Cổ Ngư dyke.',
      '1954': 'In 1957 young people of the capital helped rebuild the Cổ Ngư dyke; the road was renamed Thanh Niên (Youth) Road.',
      '1975': 'Around the lake were still the villages of Quảng An, Nhật Tân and Quảng Bá, with lotus ponds and peach gardens — a green lung at the edge of the city.',
      '2026': 'Tây Hồ is home to many foreigners, with hotels and lakeside cafés; West Lake lotus tea and sunsets over the lake are its specialities.',
      '2050': 'A walking and cycling path circles the lake, and the lotus ponds are restored as urban wetlands.',
      '2100': 'West Lake becomes the heart of a network of ecological retention lakes that help the city fight floods and keep cool.',
    },
  },
  'hoa-lo': {
    name: 'Hoa Lo Prison',
    sub: 'Maison Centrale · 1896',
    stories: {
      '1926': 'The central prison built by the French from 1896 held thousands of prisoners, many of them Vietnamese patriots and revolutionaries.',
      '1954': 'After the takeover of the capital the Vietnamese government went on using it as a prison.',
      '1975': 'From 1964 to 1973 it held American pilots shot down over the North, who jokingly called it the “Hanoi Hilton”; the prisoners of war were released in 1973.',
      '2026': 'Most of the prison was demolished in the 1990s to make way for a high-rise; the remaining part is a relic site and museum that draws many visitors.',
      '2050': 'The museum expands its digitised archive: letters, records and witness accounts are freely searchable for students and researchers.',
      '2100': 'Guided historical re-enactments help later generations understand the circumstances of the people once held here.',
    },
  },
  'dong-xuan': {
    name: 'Dong Xuan Market',
    sub: 'Chợ Đồng Xuân · 1889',
    stories: {
      '1926': 'Opened in 1889 under a five-bay iron roof, it was Hanoi’s largest market — where goods from all over Tonkin flowed into the Old Quarter.',
      '1954': 'The market was the scene of fierce fighting in the days of Hanoi’s resistance of 1946–1947; after 1954 it was again the trading centre of the capital.',
      '1975': 'In the subsidy era the market was mostly state-run counters; people queued with ration coupons, beside the small vendors around the market.',
      '2026': 'After the fire of 1994 the market was rebuilt, keeping its old façade; today it is a busy wholesale market, with a weekend night market along Hàng Đào street.',
      '2050': 'Deliveries move outside peak hours using small electric vehicles; the historic façade and the old market roof are preserved.',
      '2100': 'The market is both a place of trade and a living museum of Old Quarter commerce, with its traditional stalls kept alive.',
    },
  },
  'ga-ha-noi': {
    name: 'Hanoi Railway Station',
    sub: 'Ga Hàng Cỏ · 1902',
    stories: {
      '1926': 'The central station (Hàng Cỏ station), completed in 1902, was the hub of the lines to Haiphong, Lào Cai and the south.',
      '1954': 'After the takeover, the station was the main railway gateway of the capital of the North.',
      '1975': 'The main hall was destroyed by American bombs in 1972; the two French wings survived. After reunification Hàng Cỏ station was renamed Hanoi Station and the hall was rebuilt in a new style.',
      '2026': 'Still Hanoi’s main station and the starting point of the Reunification Express; metro line 3 has an underground “Ga Hà Nội” station right next to it.',
      '2050': 'The station becomes an interchange for national rail, metro and electric buses, with a commercial area above it.',
      '2100': 'High-speed trains and driverless metros run underground; the remaining 1902 façade is kept as a memory of the early days of Vietnam’s railways.',
    },
  },
};

/** Same order as LANDMARK_EVENTS in landmark-info.ts; `year` only where the Vietnamese label is not a number. */
export const EN_EVENTS: Record<string, Array<{ year?: string; text: string }>> = {
  'hoan-kiem': [
    { text: 'Nguyễn Văn Siêu restores Ngọc Sơn temple and builds Thê Húc bridge' },
    { text: 'Turtle Tower is built on the mound in the lake' },
    { text: '10 October: the liberation army takes over the capital' },
    { text: 'The Hoan Kiem turtle dies (Jan 2016); the lakeside walking zone opens from Sept 2016' },
  ],
  'old-quarter': [
    { text: 'Dong Xuan Market opens — the trading heart of the 36 streets' },
    { text: 'Inter-zone I fights for 60 days and nights inside the Old Quarter' },
  ],
  'ba-dinh': [
    { text: '2 September: President Hồ Chí Minh reads the Declaration of Independence in the square' },
    { text: 'Takeover of the capital; Ba Đình becomes the political centre' },
    { text: '29 August: the Hồ Chí Minh Mausoleum is inaugurated' },
  ],
  'van-mieu': [
    { text: 'King Lý Thánh Tông has the Temple of Literature built' },
    { text: 'Imperial Academy — Vietnam’s first university' },
    { text: 'Khuê Văn Các pavilion is built' },
    { text: 'The 82 Doctors’ steles are recognised by UNESCO as Memory of the World' },
  ],
  'opera-house': [
    { text: 'Construction begins, modelled on the Opéra Garnier (Paris)' },
    { text: 'Completed' },
    { text: '19 August: a rally in the Opera House square starts the seizure of power in Hanoi' },
    { text: 'A major restoration is completed' },
  ],
  'mot-cot': [
    { text: 'King Lý Thái Tông builds a lotus-shaped pagoda on a single pillar' },
    { text: '11 September: French troops blow up the pagoda before withdrawing' },
    { text: 'The pagoda is rebuilt to its original design' },
  ],
  'hoang-thanh': [
    { text: 'Lý Thái Tổ moves the capital to Thăng Long' },
    { text: 'The Hanoi Flag Tower is built under Emperor Gia Long' },
    { text: 'The citadel becomes the workplace of the Ministry of Defence' },
    { text: 'The central sector is inscribed as a UNESCO World Heritage Site' },
  ],
  'long-bien': [
    { text: 'Construction of Paul Doumer Bridge begins' },
    { text: 'Inaugurated — the first bridge across the Red River' },
    { text: 'French troops withdraw across the bridge; it is renamed Long Biên' },
    { text: 'Bombed by US aircraft' },
    { text: 'Several spans are brought down, then repaired to reopen the line' },
  ],
  'nha-tho-lon': [
    { text: 'Construction begins on the site of the old Báo Thiên pagoda' },
    { text: 'Inaugurated at Christmas' },
  ],
  'tran-quoc': [
    { year: '6th century', text: 'The pagoda is founded on the bank of the Red River under Lý Nam Đế' },
    { text: 'The pagoda is moved to Kim Ngư islet in the lake' },
    { text: 'The Cổ Ngư dyke is rebuilt and renamed Thanh Niên Road' },
  ],
  'hoa-lo': [
    { text: 'The French build the central prison (Maison Centrale)' },
    { text: 'The Vietnamese government takes over the prison' },
    { text: 'Holds American pilots — the “Hanoi Hilton”' },
    { text: 'Most of the prison is demolished for a high-rise; the rest becomes a relic site' },
  ],
  'dong-xuan': [
    { text: 'Opens under a five-bay iron roof' },
    { text: 'Scene of fierce fighting during the resistance' },
    { text: 'A major fire; the market is rebuilt, keeping its old façade' },
  ],
  'ga-ha-noi': [
    { text: 'The central station (Hàng Cỏ station) is completed' },
    { text: 'Hit by US bombs; the main hall is destroyed' },
    { year: 'After 1975', text: 'Renamed Hanoi Station; the main hall is rebuilt in a new style' },
  ],
};

/** Photo text in English (alt, caption, and the author line when it is a description rather than a name). */
export const EN_PHOTOS: Record<string, Record<string, { alt: string; caption: string; author?: string }>> = {
  'hoan-kiem': {
    '1926': { alt: 'Old black-and-white photo of Hoan Kiem Lake with a wooden bridge and temple roofs on the shore', caption: 'Hoan Kiem Lake and a wooden bridge on the shore, around 1900', author: 'Archive photo (Revue illustrée, 1902)' },
    '1954': { alt: 'Crowds crossing Thê Húc bridge to Ngọc Sơn temple at Tết 1954', caption: 'Crowds on Thê Húc bridge at Tết, February 1954' },
    '2026': { alt: 'Turtle Tower in the middle of Hoan Kiem Lake, reflected in the water at sunset', caption: 'Turtle Tower on Hoan Kiem Lake, 2014' },
  },
  'old-quarter': {
    '1926': { alt: 'Hàng Điếu street in the French era with rickshaws, tall trees and shophouses', caption: 'Hàng Điếu street (rue des Pipes), 1920s', author: 'Unknown author' },
    '1954': { alt: 'A Hanoi street in October 1954, red flags with a yellow star hanging in front of the houses', caption: 'A Hanoi street, October 1954', author: 'Unknown author' },
    '1975': { alt: 'A crossroads crowded with bicycles, cyclos and a bus in central Hanoi in the late 1970s', caption: 'Traffic in central Hanoi, 1978' },
    '2026': { alt: 'A corner of the Old Quarter with multi-storey houses, lanterns and motorbikes', caption: 'A corner of the Old Quarter, November 2024' },
  },
  'ba-dinh': {
    '1954': { alt: 'Soldiers waving their hats as they enter Hanoi on the day of the takeover', caption: 'Troops entering to take over the capital, October 1954 (an inner-city street, exact location unknown)', author: 'Unknown author' },
    '1975': { alt: 'The Declaration of Independence stand in Ba Đình Square on 2 September 1945', caption: 'The Declaration of Independence stand at Ba Đình, 2 September 1945', author: 'Việt Minh Front (archive)' },
    '2026': { alt: 'Honour guard at the flag-raising ceremony in front of the Hồ Chí Minh Mausoleum', caption: 'Hồ Chí Minh Mausoleum and honour guard, 2007' },
  },
  'van-mieu': {
    '1926': { alt: 'Mandarins in court dress at a ceremony in the courtyard of the Temple of Literature', caption: 'Ceremony at the Temple of Literature, around 1919–1928' },
    '2026': { alt: 'Khuê Văn Các pavilion seen from the brick path through the gardens of the Temple of Literature', caption: 'Khuê Văn Các seen from a path in the Temple of Literature, 2006', author: 'Chuoibk (English Wikipedia)' },
  },
  'opera-house': {
    '1926': { alt: 'Old postcard of the Opera House and rue Paul Bert with ox carts and rickshaws', caption: 'The Opera House on an early-20th-century postcard', author: 'Postcard by P. Dieulefils' },
    '1954': { alt: 'Crowds and armed forces at a rally in front of the Opera House in late August 1945', caption: 'Rally in front of the Opera House, late August 1945', author: 'Unknown author' },
    '2026': { alt: 'The yellow front of the Hanoi Opera House under a blue sky, the national flag on the roof', caption: 'Hanoi Opera House, 2016' },
  },
  'mot-cot': {
    '1926': { alt: 'Old postcard: the original One Pillar Pagoda with stone stairs leading up to the lotus platform', caption: 'The original One Pillar Pagoda (before its destruction in 1954), early-20th-century postcard', author: 'Postcard, unknown author' },
    '2026': { alt: 'One Pillar Pagoda on its stone pillar in a pond, surrounded by trees', caption: 'One Pillar Pagoda, 2013' },
  },
  'hoang-thanh': {
    '1926': { alt: 'Old postcard: the Hanoi Flag Tower seen from the citadel wall, with barracks in front', caption: 'The Flag Tower in the old citadel, postcard from around 1905' },
    '2026': { alt: 'The Hanoi Flag Tower with a red flag with a yellow star on top, on its three-tier base', caption: 'Hanoi Flag Tower, 2012' },
  },
  'long-bien': {
    '1926': { alt: 'Old postcard of Doumer Bridge (Long Biên Bridge) across the Red River', caption: 'Doumer Bridge (now Long Biên Bridge) on an early-20th-century postcard', author: 'Postcard, unknown author' },
    '2026': { alt: 'Rail track and a motorbike lane between the old steel girders of Long Biên Bridge', caption: 'On Long Biên Bridge, 2014' },
  },
  'nha-tho-lon': {
    '1926': { alt: 'Old postcard: parishioners leaving Mass on the street in front of St. Joseph’s Cathedral', caption: 'The cathedral after Mass, early-20th-century postcard', author: 'Postcard by P. Dieulefils' },
    '2026': { alt: 'The Gothic façade and twin bell towers of St. Joseph’s Cathedral', caption: 'St. Joseph’s Cathedral, Hanoi, 2018' },
  },
  'tran-quoc': {
    '1926': { alt: 'Old postcard: an earthen road along West Lake, a person in a conical hat standing on the bank', caption: 'Cổ Ngư road (now Thanh Niên Road) along West Lake, postcard from the late 19th – early 20th century', author: 'Postcard, P. Dieulefils collection' },
    '2026': { alt: 'Trấn Quốc pagoda on the shore of West Lake with old trees', caption: 'Trấn Quốc pagoda on West Lake, 2024' },
  },
  'hoa-lo': {
    '1975': { alt: 'Black-and-white aerial photo of Hỏa Lò prison, captioned Hanoi Hilton', caption: 'Aerial photo of Hỏa Lò prison (“Hanoi Hilton”), 1970', author: 'US military archive photo' },
    '2026': { alt: 'A recreated cell with statues of shackled prisoners in the Hỏa Lò relic site', caption: 'Recreated cell in the Hỏa Lò relic site, 2017' },
  },
  'dong-xuan': {
    '1926': { alt: 'Old postcard of Dong Xuan Market with its large arched roofs', caption: 'Dong Xuan Market (“Les Halles”) on an early-20th-century postcard', author: 'Postcard by P. Dieulefils' },
    '2026': { alt: 'The front of Dong Xuan Market with its sign and motorbike traffic on the street', caption: 'Dong Xuan Market, 2018' },
  },
  'ga-ha-noi': {
    '1926': { alt: 'Old postcard of the French-style front of Hanoi station with rickshaws in front', caption: 'Front of Hanoi station on an early-20th-century postcard', author: 'Postcard by P. Dieulefils' },
    '2026': { alt: 'Hanoi station at night: the modern central block rebuilt after 1975 between two French wings', caption: 'Hanoi station at night, 2023' },
  },
};

export const EN_TOURS: Record<string, { name: string; description: string }> = {
  'lake-old-quarter': { name: 'Hoan Kiem Lake & Old Quarter', description: 'From Turtle Tower through the 36 streets and Dong Xuan Market to Long Biên Bridge over the Red River.' },
  'french-quarter': { name: 'French Quarter', description: 'French-era buildings around the lake: the Cathedral, Hỏa Lò prison and the Opera House.' },
  'citadel-ba-dinh': { name: 'Temple of Literature, Citadel & Ba Đình', description: 'From Hanoi station past Vietnam’s first university, the Flag Tower, Ba Đình Square and One Pillar Pagoda to West Lake.' },
};

/** Same order as the component's suggested questions. */
export const EN_QA: Array<{ q: string; a: string; src: string }> = [
  {
    q: 'What is the legend of Hoan Kiem Lake?',
    a: 'Legend has it that King Lê Lợi borrowed a magic sword to drive out the Ming invaders; after his victory a golden turtle rose from the lake to take the sword back — hence the name Hoàn Kiếm, “returned sword”.',
    src: 'Source: folk legend, recorded in historical writings on Hanoi.',
  },
  {
    q: 'What happened at Ba Đình in 1945?',
    a: 'On 2 September 1945, in Ba Đình Square, President Hồ Chí Minh read the Declaration of Independence, founding the Democratic Republic of Vietnam.',
    src: 'Source: official Vietnamese historical records.',
  },
  {
    q: 'What will Hanoi look like in 2100?',
    a: 'This is a scenario imagined by AI: heritage areas are preserved as “living museums” with micro-climate sensors, while new urban districts develop elevated transport and digital spaces alongside physical ones.',
    src: 'This is an AI-generated future scenario — not a firm prediction.',
  },
  {
    q: 'How many craft streets does the Old Quarter have?',
    a: 'Hanoi’s Old Quarter is often called the “36 streets”; each old street was tied to its own craft or trade, such as Hàng Bạc (silver), Hàng Mã (votive paper) and Hàng Gai (hemp).',
    src: 'Source: historical records on Hanoi’s urban history.',
  },
  {
    q: 'When was One Pillar Pagoda destroyed?',
    a: 'On 11 September 1954, before withdrawing from Hanoi, the French army mined and destroyed One Pillar Pagoda. It was rebuilt in 1955 to its original design — a design dating from 1049 under King Lý Thái Tông.',
    src: 'Source: historical records on One Pillar Pagoda (Diên Hựu temple).',
  },
  {
    q: 'Why was Hỏa Lò called the “Hanoi Hilton”?',
    a: 'From 1964 to 1973 Hỏa Lò prison held American pilots shot down over the North; they gave it the ironic nickname “Hanoi Hilton”. The remaining part of the prison is now a relic site and museum.',
    src: 'Source: historical records on the Hỏa Lò prison relic site.',
  },
  {
    q: 'When was Long Biên Bridge built?',
    a: 'The bridge was completed in 1902 as Paul Doumer Bridge, about 1.7 km long, and was once the only bridge across the Red River. It was bombed many times in 1967 and 1972 but still stands today.',
    src: 'Source: historical records on Hanoi’s transport.',
  },
];

/** English Wikipedia articles matching the Vietnamese source articles (from Wikidata sitelinks). */
export const EN_WIKI: Record<string, string> = {
  'Hồ Hoàn Kiếm': 'Hoàn Kiếm Lake',
  'Tháp Rùa': 'Turtle Tower',
  'Khu phố cổ Hà Nội': 'Old Quarter, Hanoi',
  'Chợ Đồng Xuân': 'Đồng Xuân Market',
  'Quảng trường Ba Đình': 'Ba Đình Square',
  'Lăng Chủ tịch Hồ Chí Minh': 'Ho Chi Minh Mausoleum',
  'Văn Miếu – Quốc Tử Giám': 'Temple of Literature, Hanoi',
  'Nhà hát Lớn Hà Nội': 'Hanoi Opera House',
  'Chùa Một Cột': 'One Pillar Pagoda',
  'Hoàng thành Thăng Long': 'Imperial Citadel of Thăng Long',
  'Cột cờ Hà Nội': 'Flag Tower of Hanoi',
  'Cầu Long Biên': 'Long Biên Bridge',
  'Nhà thờ Lớn Hà Nội': "St. Joseph's Cathedral, Hanoi",
  'Chùa Trấn Quốc': 'Trấn Quốc Pagoda',
  'Hồ Tây': 'West Lake (Hanoi)',
  'Nhà tù Hỏa Lò': 'Hỏa Lò Prison',
  'Ga Hà Nội': 'Hanoi railway station',
};

/** Translations of the site labels used in landmark-info.ts. */
export const EN_SITE: Record<string, string> = {
  'Wikipedia tiếng Việt': 'Vietnamese Wikipedia',
  'Trang chính thức của di tích': 'Official site',
};

export const EN_TICKER = ['CALIBRATING THE TIMELINE', 'LOADING 1926 DATA', 'LOADING THE 2100 SCENARIO', 'READY TO OPEN THE TIME PORTAL'];
