import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LANDMARK_PHOTOS, LandmarkPhoto } from './time-machine-photos';

interface Era {
  id: string;
  year: string;
  label: string;
  tag: string;
  future: boolean;
}

interface Landmark {
  name: string;
  sub: string;
  stories: Record<string, string>;
}

interface ChatAnswer {
  q: string;
  a: string;
  src: string;
  future: boolean;
}

@Component({
  selector: 'app-time-machine',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './time-machine.component.html',
  styleUrl: './time-machine.component.css',
  // This page's interactive bits (era ticks, chat bubbles, chips) are built
  // with plain DOM APIs at runtime, so they never get Angular's emulated
  // `_ngcontent` scoping attribute. Emulated encapsulation would silently
  // fail to style them — every selector below is `tm-`-prefixed instead so
  // global styles stay safely namespaced.
  encapsulation: ViewEncapsulation.None,
})
export class TimeMachineComponent implements AfterViewInit, OnDestroy {
  private readonly root: HTMLElement;
  private readonly reduceMotion: boolean;

  private readonly eras: Era[] = [
    { id: '1926', year: '1926', label: 'Thời Pháp thuộc', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
    { id: '1954', year: '1954', label: 'Giải phóng Thủ đô', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
    { id: '1975', year: '1975', label: 'Thống nhất đất nước', tag: 'TƯ LIỆU LỊCH SỬ', future: false },
    { id: '2026', year: '2026', label: 'Hiện tại', tag: 'HIỆN TẠI', future: false },
    { id: '2050', year: '2050', label: 'Kịch bản tương lai', tag: 'KỊCH BẢN TƯƠNG LAI', future: true },
    { id: '2100', year: '2100', label: 'Kịch bản viễn tưởng', tag: 'KỊCH BẢN TƯƠNG LAI', future: true },
  ];

  private readonly landmarks: Record<string, Landmark> = {
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
  };

  private readonly qa: ChatAnswer[] = [
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
  ];

  private scopeEl!: HTMLElement;
  private state = { eraIndex: 3, landmark: 'hoan-kiem' };
  private tickerInterval?: ReturnType<typeof setInterval>;
  private typewriterTimeouts: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> = [];
  private railObserver?: IntersectionObserver;
  private revealObserver?: IntersectionObserver;

  constructor(hostRef: ElementRef<HTMLElement>) {
    this.root = hostRef.nativeElement;
    this.reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  ngAfterViewInit(): void {
    this.scopeEl = this.q('.tm-root') ?? this.root;
    this.buildEraTicks();
    this.buildChatChips();
    this.wireSlider();
    this.wirePins();
    this.wireNavToggle();
    this.wireLocalAnchors();
    this.wireChatForm();
    this.render();
    this.startTicker();
    this.setupRail();
    this.setupReveal();
  }

  ngOnDestroy(): void {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
    this.typewriterTimeouts.forEach((t) => {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      clearInterval(t as ReturnType<typeof setInterval>);
    });
    this.railObserver?.disconnect();
    this.revealObserver?.disconnect();
  }

  private q<T extends Element = HTMLElement>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }

  private qa_<T extends Element = HTMLElement>(selector: string, scope: ParentNode = this.root): T[] {
    return Array.from(scope.querySelectorAll<T>(selector));
  }

  private currentEra(): Era {
    return this.eras[this.state.eraIndex];
  }

  private render(): void {
    const era = this.currentEra();
    const lm = this.landmarks[this.state.landmark];

    const mapEraBadge = this.q('#tm-mapEraBadge');
    if (mapEraBadge) mapEraBadge.textContent = `${era.tag} · ${era.year}`;
    const mapName = this.q('#tm-mapName');
    if (mapName) mapName.textContent = lm.name;
    const mapSub = this.q('#tm-mapSub');
    if (mapSub) mapSub.textContent = lm.sub;
    const mapStory = this.q('#tm-mapStory');
    if (mapStory) mapStory.textContent = lm.stories[era.id];
    const mapScenario = this.q('#tm-mapScenario');
    mapScenario?.classList.toggle('show', era.future);

    const eraYearLabel = this.q('#tm-eraYearLabel');
    if (eraYearLabel) eraYearLabel.textContent = `${era.year} · ${era.tag}`;
    const eraLandmarkLabel = this.q('#tm-eraLandmarkLabel');
    if (eraLandmarkLabel) eraLandmarkLabel.textContent = lm.name;
    const eraStoryLabel = this.q('#tm-eraStoryLabel');
    if (eraStoryLabel) eraStoryLabel.textContent = lm.stories[era.id];

    const photo = LANDMARK_PHOTOS[this.state.landmark]?.[era.id];
    this.showPhoto('#tm-eraPhoto', '#tm-eraCredit', '#tm-eraVisual', photo, era);
    this.showPhoto('#tm-mapPhoto', '#tm-mapPhotoCredit', '#tm-mapPhotoBox', photo, era);

    this.scopeEl.setAttribute('data-era', era.id);

    this.qa_('.tm-era-tick').forEach((t, i) => t.classList.toggle('active', i === this.state.eraIndex));
    this.qa_('.tm-pin').forEach((p) => p.classList.toggle('active', p.dataset['landmark'] === this.state.landmark));
  }

  /**
   * Shows the real photo of the selected landmark for the current era, with its credit. Without one
   * the timeline keeps its illustration (labelled as such) and the map thumbnail is hidden.
   */
  private showPhoto(imgSel: string, creditSel: string, boxSel: string, photo: LandmarkPhoto | undefined, era: Era): void {
    const img = this.q<HTMLImageElement>(imgSel);
    const credit = this.q(creditSel);
    const box = this.q(boxSel);
    if (!img || !credit || !box) return;
    const isMapThumb = boxSel === '#tm-mapPhotoBox';

    credit.replaceChildren();
    if (!photo) {
      img.hidden = true;
      img.removeAttribute('src');
      img.classList.remove('loaded');
      box.classList.remove('has-photo');
      if (isMapThumb) {
        box.hidden = true;
      } else {
        credit.textContent = era.future
          ? 'Hình minh hoạ kịch bản do AI hình dung — không phải ảnh thật'
          : 'Chưa có ảnh tư liệu cho mốc này — đang dùng hình minh hoạ';
      }
      return;
    }

    if (!img.getAttribute('src')?.endsWith(photo.src)) {
      img.classList.remove('loaded');
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.src = photo.src;
    }
    img.alt = photo.alt;
    img.dataset['fit'] = photo.fit ?? 'cover';
    img.style.objectPosition = photo.position ?? '50% 50%';
    img.hidden = false;
    box.hidden = false;
    box.classList.add('has-photo');

    const cap = document.createElement('span');
    cap.className = 'tm-credit-cap';
    cap.textContent = photo.caption;
    const link = document.createElement('a');
    link.href = photo.pageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Ảnh: ${photo.author} · ${photo.license}`;
    credit.append(cap, link);
  }

  private buildEraTicks(): void {
    const wrap = this.q('#tm-eraTicks');
    if (!wrap) return;
    this.eras.forEach((era, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-era-tick';
      const dot = document.createElement('span');
      dot.className = 'dot';
      b.appendChild(dot);
      b.appendChild(document.createTextNode(era.year));
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = era.tag;
      b.appendChild(tag);
      b.addEventListener('click', () => {
        this.state.eraIndex = i;
        const slider = this.q<HTMLInputElement>('#tm-eraSlider');
        if (slider) slider.value = String(i);
        this.render();
      });
      wrap.appendChild(b);
    });
  }

  private wireSlider(): void {
    const slider = this.q<HTMLInputElement>('#tm-eraSlider');
    slider?.addEventListener('input', () => {
      this.state.eraIndex = parseInt(slider.value, 10);
      this.render();
    });
  }

  private wirePins(): void {
    this.qa_('.tm-pin').forEach((p) => {
      p.addEventListener('click', () => {
        this.state.landmark = p.dataset['landmark'] ?? this.state.landmark;
        this.render();
      });
    });
  }

  private wireNavToggle(): void {
    const toggle = this.q('#tm-navToggle');
    const mobile = this.q('#tm-navMobile');
    if (!toggle || !mobile) return;
    toggle.addEventListener('click', () => {
      const open = mobile.hasAttribute('hidden');
      if (open) {
        mobile.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
      } else {
        mobile.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    this.qa_('a', mobile).forEach((a) => {
      a.addEventListener('click', () => {
        mobile.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // index.html sets <base href="/"> for Angular routing, which makes the
  // browser resolve a plain href="#tm-map" against "/" instead of the
  // current "/time-machine" — clicking it jumps to the home route instead
  // of scrolling. Handling these in-page links ourselves sidesteps that.
  private wireLocalAnchors(): void {
    this.qa_<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute('href')?.slice(1);
      if (!id) return;
      a.addEventListener('click', (e) => {
        const target = this.q(`#${id}`);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  private startTicker(): void {
    if (this.reduceMotion) return;
    const ticker = this.q('#tm-heroTicker');
    if (!ticker || !ticker.firstChild) return;
    const phrases = [
      'ĐANG HIỆU CHỈNH DÒNG THỜI GIAN',
      'ĐANG TẢI DỮ LIỆU 1926',
      'ĐANG TẢI KỊCH BẢN 2100',
      'SẴN SÀNG MỞ CỔNG THỜI GIAN',
    ];
    let pi = 0;
    this.tickerInterval = setInterval(() => {
      pi = (pi + 1) % phrases.length;
      ticker.firstChild!.nodeValue = phrases[pi] + ' ';
    }, 3200);
  }

  private setupRail(): void {
    const rail = this.q('#tm-rail');
    if (!rail) return;
    const railDots = this.qa_<HTMLElement>('.tm-rail-dot', rail);
    const sections = railDots.map((d) => this.q(`#${d.dataset['target']}`));
    this.railObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sections.indexOf(entry.target as HTMLElement);
            railDots.forEach((d, i) => d.classList.toggle('active', i === idx));
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    sections.forEach((s) => {
      if (s) this.railObserver!.observe(s);
    });
  }

  private setupReveal(): void {
    const revealEls = this.qa_('.tm-reveal');
    if (!revealEls.length) return;
    if (this.reduceMotion) {
      revealEls.forEach((el) => el.classList.add('in'));
      return;
    }
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            this.revealObserver!.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => this.revealObserver!.observe(el));
  }

  private buildChatChips(): void {
    const chipRow = this.q('#tm-chatChips');
    if (!chipRow) return;
    this.qa.forEach((item) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'tm-chip';
      c.textContent = item.q;
      c.addEventListener('click', () => this.askQuestion(item.q));
      chipRow.appendChild(c);
    });
  }

  private wireChatForm(): void {
    const form = this.q<HTMLFormElement>('#tm-chatForm');
    const input = this.q<HTMLInputElement>('#tm-chatInput');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input?.value.trim();
      if (!val) return;
      this.askQuestion(val);
      if (input) input.value = '';
    });
  }

  private scrollChat(): void {
    const log = this.q('#tm-chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  private addUserBubble(text: string): void {
    const log = this.q('#tm-chatLog');
    if (!log) return;
    const b = document.createElement('div');
    b.className = 'tm-bubble tm-user';
    b.textContent = text;
    log.appendChild(b);
    this.scrollChat();
  }

  private addAiBubble(item: ChatAnswer): void {
    const log = this.q('#tm-chatLog');
    if (!log) return;
    const b = document.createElement('div');
    b.className = 'tm-bubble tm-ai' + (item.future ? ' tm-future' : '');

    if (this.reduceMotion) {
      b.appendChild(document.createTextNode(item.a));
      const src = document.createElement('span');
      src.className = 'tm-src';
      src.textContent = item.src;
      b.appendChild(src);
      log.appendChild(b);
      this.scrollChat();
      return;
    }

    const typing = document.createElement('span');
    typing.className = 'tm-typing';
    for (let i = 0; i < 3; i++) typing.appendChild(document.createElement('span'));
    b.appendChild(typing);
    log.appendChild(b);
    this.scrollChat();

    const startTimeout = setTimeout(() => {
      b.textContent = '';
      const textNode = document.createTextNode('');
      b.appendChild(textNode);
      let i = 0;
      const interval = setInterval(() => {
        textNode.nodeValue = item.a.slice(0, i);
        i++;
        this.scrollChat();
        if (i > item.a.length) {
          clearInterval(interval);
          const src = document.createElement('span');
          src.className = 'tm-src';
          src.textContent = item.src;
          b.appendChild(src);
          this.scrollChat();
        }
      }, 14);
      this.typewriterTimeouts.push(interval);
    }, 500);
    this.typewriterTimeouts.push(startTimeout);
  }

  private askQuestion(text: string): void {
    this.addUserBubble(text);
    const match = this.qa.find((item) => item.q === text) ?? {
      q: text,
      a: 'Câu hỏi thú vị! Trong bản demo này, hãy thử một trong các câu hỏi gợi ý bên trên để xem AI Storyteller hoạt động.',
      src: 'Demo — chưa kết nối cơ sở dữ liệu đầy đủ.',
      future: false,
    };
    this.addAiBubble(match);
  }
}
