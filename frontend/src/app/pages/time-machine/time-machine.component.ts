import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LANDMARK_PHOTOS, LandmarkPhoto } from './time-machine-photos';
import { ERAS, Era, LANDMARKS, Landmark } from './tm-data';
import { landmarkIcon } from './landmark-icons';
import { LANDMARK_EVENTS, LANDMARK_INFO, LandmarkSource, directionsUrl, eraForYear } from './landmark-info';
import { TmRealMap } from './tm-real-map';
import { TOURS, Tour } from './landmark-tours';
import { TmContext } from './tm-context';
import { TmLens } from './tm-lens';
import { TmEdu } from './tm-edu';
import { TmMuseum } from './tm-museum';
import { TmChat } from './tm-chat';
import { TmTours } from './tm-tours';
import { TmCompare } from './tm-compare';
import { EN_ERAS, EN_EVENTS, EN_LANDMARKS, EN_PHOTOS, EN_SITE, EN_TICKER, EN_TOURS, EN_WIKI, LANG_KEY, Lang } from './tm-i18n';
import { ThemeService } from '../../services/theme.service';

type MapMode = 'real' | 'illustrated';
const MAP_MODE_KEY = 'hanoi100.tm.mapMode';
const PD_VI = 'Phạm vi công cộng';
const VI_TICKER = ['ĐANG HIỆU CHỈNH DÒNG THỜI GIAN', 'ĐANG TẢI DỮ LIỆU 1926', 'ĐANG TẢI KỊCH BẢN 2100', 'SẴN SÀNG MỞ CỔNG THỜI GIAN'];

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

/** Eras whose photo can stand as "then" in the before/after comparison, oldest first. */
const THEN_ERAS = ['1926', '1954', '1975'];

@Component({
  selector: 'app-time-machine',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './time-machine.component.html',
  styleUrls: ['./time-machine.component.css', './time-machine-features.css'],
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
  private readonly eras = ERAS;
  private readonly landmarks = LANDMARKS;

  private scopeEl!: HTMLElement;
  private state = { eraIndex: 3, landmark: 'hoan-kiem' };
  private tickerInterval?: ReturnType<typeof setInterval>;
  private railObserver?: IntersectionObserver;
  private revealObserver?: IntersectionObserver;
  private readonly theme = inject(ThemeService);
  private realMap?: TmRealMap;
  /** Page language; Vietnamese is the source text, English comes from tm-i18n.ts. */
  private lang: Lang = readLang();
  /** Vietnamese originals of the template text replaced by data-en translations. */
  private readonly viText = new Map<Element, string>();
  private lens?: TmLens;
  /** Set once the page is set up; from then on selections are mirrored in the URL. */
  private urlSync = false;
  private edu?: TmEdu;
  private museum?: TmMuseum;
  private chat?: TmChat;
  private tours?: TmTours;
  private compare?: TmCompare;

  /** The page's data and selection, as the Time Lens and Education modules see them. */
  private readonly ctx: TmContext = {
    lang: () => this.lang,
    tr: (vi, en) => this.tr(vi, en),
    keys: () => Object.keys(this.landmarks),
    name: (key) => this.lm(key).name,
    sub: (key) => this.lm(key).sub,
    landmarkUrl: (key) => {
      const params = new URLSearchParams({ landmark: key });
      if (this.lang === 'en') params.set('lang', 'en');
      return `${location.origin}${location.pathname}?${params.toString()}`;
    },
    events: (key) => this.events(key),
    tours: () => TOURS.map((t) => ({ id: t.id, name: this.tourText(t).name, stops: t.stops })),
    thenPhoto: (key) => {
      const era = THEN_ERAS.find((e) => LANDMARK_PHOTOS[key]?.[e]);
      const photo = era ? this.photo(key, era) : undefined;
      return era && photo ? { era, photo } : null;
    },
    photo: (key, eraId) => this.photo(key, eraId),
    current: () => this.state.landmark,
    era: () => this.currentEra().id,
    select: (key, eraId) => {
      this.state.landmark = key;
      const index = eraId ? this.eras.findIndex((e) => e.id === eraId) : -1;
      if (index >= 0) {
        this.state.eraIndex = index;
        const slider = this.q<HTMLInputElement>('#tm-eraSlider');
        if (slider) slider.value = String(index);
      }
      this.render();
    },
    link: (text, url) => this.sourceLink(text, url),
  };

  constructor(hostRef: ElementRef<HTMLElement>) {
    this.root = hostRef.nativeElement;
    this.reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    effect(() => {
      // Read the signal first: with `this.realMap?.setTheme(...)` the read is skipped while the map
      // doesn't exist yet, and the effect would never re-run.
      const theme = this.theme.effective();
      this.realMap?.setTheme(theme);
    });
  }

  ngAfterViewInit(): void {
    this.scopeEl = this.q('.tm-root') ?? this.root;
    // Shared links carry ?landmark=&era=, assignment links ?quiz=&n=&seed=; both may add &lang= (used for this
    // visit only, not remembered).
    const params = new URLSearchParams(location.search);
    const langParam = params.get('lang');
    if (langParam === 'vi' || langParam === 'en') this.lang = langParam;
    const landmarkParam = params.get('landmark');
    if (landmarkParam && this.landmarks[landmarkParam]) this.state.landmark = landmarkParam;
    const eraIndex = this.eras.findIndex((e) => e.id === params.get('era'));
    if (eraIndex >= 0) this.state.eraIndex = eraIndex;
    const slider = this.q<HTMLInputElement>('#tm-eraSlider');
    if (slider) slider.value = String(this.state.eraIndex);
    this.wireLangToggle();
    this.translateStatic();
    this.buildEraTicks();
    this.wireSlider();
    this.buildLandmarkList();
    this.wirePins();
    this.wireMapMode();
    this.tours = new TmTours(this.root, this.ctx, (stops) => {
      if (stops.length) this.setMapMode('real', false);
      this.realMap?.showTour(stops);
    });
    this.tours.refresh();
    this.compare = new TmCompare(this.root, this.ctx);
    this.compare.init();
    this.renamePins();
    this.lens = new TmLens(this.root, this.ctx);
    this.lens.init();
    this.edu = new TmEdu(this.root, this.ctx);
    const quiz = params.get('quiz');
    this.edu.init(quiz ? { scope: quiz, count: Math.min(20, Math.max(1, Number(params.get('n')) || 10)), seed: Number(params.get('seed')) || 1 } : undefined);
    this.museum = new TmMuseum(this.root, this.ctx);
    this.museum.init();
    if (quiz) setTimeout(() => this.q('#tm-education')?.scrollIntoView(), 300);
    else if (landmarkParam && this.landmarks[landmarkParam]) setTimeout(() => this.q('#tm-map')?.scrollIntoView(), 300);
    this.q('#tm-mapShare')?.addEventListener('click', () => void this.shareCurrent());
    this.wireNavToggle();
    this.wireLocalAnchors();
    this.chat = new TmChat(this.root, this.ctx, this.reduceMotion);
    this.chat.init();
    this.render();
    this.startTicker();
    this.setupRail();
    this.setupReveal();
    this.urlSync = true;
  }

  /** Link to the selected landmark and era (and the language, when English). */
  private shareUrl(key = this.state.landmark): string {
    const params = new URLSearchParams({ landmark: key, era: this.currentEra().id });
    if (this.lang === 'en') params.set('lang', 'en');
    return `${location.origin}${location.pathname}?${params.toString()}`;
  }

  /** Keeps the address bar on the current landmark/era, so it can be copied or bookmarked. */
  private syncUrl(): void {
    if (!this.urlSync) return;
    const params = new URLSearchParams(location.search);
    params.set('landmark', this.state.landmark);
    params.set('era', this.currentEra().id);
    history.replaceState(history.state, '', `${location.pathname}?${params.toString()}${location.hash}`);
  }

  /** Phones: the share sheet. Elsewhere: copy the link (with a fallback when the Clipboard API is refused). */
  private async shareCurrent(): Promise<void> {
    const url = this.shareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: `${this.lm(this.state.landmark).name} · ${this.currentEra().year} · Hanoi Time Machine`, url });
      } catch {
        // share sheet closed — nothing to do
      }
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      field.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(field);
      field.select();
      copied = document.execCommand?.('copy') ?? false;
      field.remove();
    }
    const button = this.q('#tm-mapShare');
    if (!button) return;
    button.textContent = copied ? this.tr('Đã chép link ✓', 'Link copied ✓') : this.tr('Link đã có trên thanh địa chỉ', 'The link is in the address bar');
    setTimeout(() => (button.textContent = this.tr('Chia sẻ ↗', 'Share ↗')), 2500);
  }

  ngOnDestroy(): void {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
    this.chat?.destroy();
    this.railObserver?.disconnect();
    this.revealObserver?.disconnect();
    this.realMap?.destroy();
    this.lens?.destroy();
    this.museum?.destroy();
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

  // ---------- Language ----------

  /** Vietnamese or English text, by page language. */
  private tr(vi: string, en: string): string {
    return this.lang === 'en' ? en : vi;
  }

  private lm(key: string): Landmark {
    const vi = this.landmarks[key];
    return this.lang === 'en' && EN_LANDMARKS[key] ? { ...vi, ...EN_LANDMARKS[key] } : vi;
  }

  private eraTag(era: Era): string {
    return this.lang === 'en' ? (EN_ERAS[era.id]?.tag ?? era.tag) : era.tag;
  }

  private photo(key: string, eraId: string): LandmarkPhoto | undefined {
    const vi = LANDMARK_PHOTOS[key]?.[eraId];
    if (!vi || this.lang === 'vi') return vi;
    return { ...vi, ...EN_PHOTOS[key]?.[eraId], license: vi.license === PD_VI ? 'Public domain' : vi.license };
  }

  private events(key: string): Array<{ year: string; sort: number; text: string }> {
    return (LANDMARK_EVENTS[key] ?? []).map((event, i) => {
      const en = this.lang === 'en' ? EN_EVENTS[key]?.[i] : undefined;
      return en ? { ...event, year: en.year ?? event.year, text: en.text } : event;
    });
  }

  /** In English, each Vietnamese Wikipedia source is preceded by its English Wikipedia article when there is one. */
  private sources(key: string): LandmarkSource[] {
    const sources = LANDMARK_INFO[key]?.sources ?? [];
    if (this.lang === 'vi') return sources;
    return sources.flatMap((src) => {
      const translated = { ...src, site: EN_SITE[src.site] ?? src.site };
      const enTitle = src.site === 'Wikipedia tiếng Việt' ? EN_WIKI[src.title] : undefined;
      if (!enTitle) return [translated];
      const english = { title: enTitle, site: 'English Wikipedia', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle.replace(/ /g, '_'))}` };
      return [english, translated];
    });
  }

  private tourText(tour: Tour): { name: string; description: string } {
    return this.lang === 'en' ? (EN_TOURS[tour.id] ?? tour) : tour;
  }

  private wireLangToggle(): void {
    this.q('#tm-langToggle')?.addEventListener('click', () => this.setLang(this.lang === 'vi' ? 'en' : 'vi'));
  }

  private setLang(lang: Lang): void {
    this.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // storage blocked — the choice just isn't remembered
    }
    this.translateStatic();
    this.buildEraTicks();
    this.chat?.refresh();
    this.buildLandmarkList();
    this.compare?.refresh();
    this.tours?.refresh();
    this.renamePins();
    const ticker = this.q('#tm-heroTicker')?.firstChild;
    if (ticker) ticker.nodeValue = `${this.tickerPhrases()[0]} `;
    this.edu?.refresh();
    this.museum?.refresh();
    this.render();
  }

  /**
   * Swaps template text for its data-en / data-en-html / data-en-placeholder / data-en-aria-label translation
   * (and back), remembering the Vietnamese original the first time.
   */
  private translateStatic(): void {
    const en = this.lang === 'en';
    this.scopeEl.setAttribute('lang', this.lang);
    const swap = (el: Element, key: string, read: () => string, write: (v: string) => void, translation: string) => {
      if (key === 'text' || key === 'html') {
        if (!this.viText.has(el)) this.viText.set(el, read());
        write(en ? translation : (this.viText.get(el) ?? ''));
      } else {
        const attr = `data-vi-${key}`;
        if (!el.hasAttribute(attr)) el.setAttribute(attr, read());
        write(en ? translation : (el.getAttribute(attr) ?? ''));
      }
    };
    this.qa_('[data-en]').forEach((el) => swap(el, 'text', () => el.textContent ?? '', (v) => (el.textContent = v), el.getAttribute('data-en') ?? ''));
    this.qa_('[data-en-html]').forEach((el) => swap(el, 'html', () => el.innerHTML, (v) => (el.innerHTML = v), el.getAttribute('data-en-html') ?? ''));
    for (const attr of ['placeholder', 'aria-label']) {
      this.qa_(`[data-en-${attr}]`).forEach((el) =>
        swap(el, attr, () => el.getAttribute(attr) ?? '', (v) => el.setAttribute(attr, v), el.getAttribute(`data-en-${attr}`) ?? ''),
      );
    }
    const toggle = this.q('#tm-langToggle');
    if (toggle) {
      toggle.textContent = en ? 'VI' : 'EN';
      toggle.setAttribute('aria-label', en ? 'Chuyển sang tiếng Việt' : 'Switch to English');
      toggle.setAttribute('lang', en ? 'vi' : 'en');
    }
  }

  /** Names on the illustrated-map pins and the real-map markers. */
  private renamePins(): void {
    this.qa_('.tm-pin').forEach((pin) => {
      const name = this.lm(pin.dataset['landmark'] ?? '')?.name;
      if (!name) return;
      pin.setAttribute('aria-label', name);
      const tag = pin.querySelector('.tm-pin-tag');
      if (tag) tag.textContent = name;
    });
    this.realMap?.setNames(Object.fromEntries(Object.keys(this.landmarks).map((key) => [key, this.lm(key).name])));
  }

  private tickerPhrases(): string[] {
    return this.lang === 'en' ? EN_TICKER : VI_TICKER;
  }

  private render(): void {
    const era = this.currentEra();
    const lm = this.lm(this.state.landmark);

    const mapEraBadge = this.q('#tm-mapEraBadge');
    if (mapEraBadge) mapEraBadge.textContent = `${this.eraTag(era)} · ${era.year}`;
    const mapName = this.q('#tm-mapName');
    if (mapName) mapName.textContent = lm.name;
    const mapSub = this.q('#tm-mapSub');
    if (mapSub) mapSub.textContent = lm.sub;
    const mapStory = this.q('#tm-mapStory');
    if (mapStory) mapStory.textContent = lm.stories[era.id];
    const mapScenario = this.q('#tm-mapScenario');
    mapScenario?.classList.toggle('show', era.future);

    const eraYearLabel = this.q('#tm-eraYearLabel');
    if (eraYearLabel) eraYearLabel.textContent = `${era.year} · ${this.eraTag(era)}`;
    const eraLandmarkLabel = this.q('#tm-eraLandmarkLabel');
    if (eraLandmarkLabel) eraLandmarkLabel.textContent = lm.name;
    const eraStoryLabel = this.q('#tm-eraStoryLabel');
    if (eraStoryLabel) eraStoryLabel.textContent = lm.stories[era.id];

    this.renderSources(era);
    this.renderEvents(era, lm.name);
    const directions = this.q<HTMLAnchorElement>('#tm-mapDirections');
    const info = LANDMARK_INFO[this.state.landmark];
    if (directions && info) {
      directions.href = directionsUrl(info.lngLat);
      directions.setAttribute('aria-label', this.tr(`Chỉ đường tới ${lm.name} trên Google Maps (mở tab mới)`, `Directions to ${lm.name} on Google Maps (opens a new tab)`));
    }

    const photo = this.photo(this.state.landmark, era.id);
    this.showPhoto('#tm-eraPhoto', '#tm-eraCredit', '#tm-eraVisual', photo, era);
    this.showPhoto('#tm-mapPhoto', '#tm-mapPhotoCredit', '#tm-mapPhotoBox', photo, era);

    this.scopeEl.setAttribute('data-era', era.id);

    this.qa_('.tm-era-tick').forEach((t, i) => t.classList.toggle('active', i === this.state.eraIndex));
    this.qa_('.tm-pin, .tm-lm[data-landmark], .tm-tour-stop').forEach((p) => {
      const on = p.dataset['landmark'] === this.state.landmark;
      p.classList.toggle('active', on);
      p.setAttribute('aria-pressed', String(on));
    });
    this.realMap?.select(this.state.landmark);
    this.compare?.render();
    this.lens?.refresh();
    this.syncUrl();
  }

  /** Reference list in the map panel, and a one-line "Nguồn:" under the timeline story. */
  private renderSources(era: Era): void {
    const sources = this.sources(this.state.landmark);
    const list = this.q('#tm-mapSources');
    if (list) {
      list.replaceChildren(
        ...sources.map((src) => {
          const li = document.createElement('li');
          const site = document.createElement('span');
          site.className = 'tm-sources-site';
          site.textContent = ` · ${src.site}`;
          li.append(this.sourceLink(src.title, src.url), site);
          return li;
        }),
      );
    }
    const line = this.q('#tm-eraSources');
    if (!line) return;
    line.replaceChildren();
    if (era.future) {
      line.textContent = this.tr('Kịch bản do AI hình dung — không có nguồn tư liệu.', 'A scenario imagined by AI — no historical sources.');
      return;
    }
    line.append(this.tr('Nguồn: ', 'Sources: '));
    sources.forEach((src, i) => {
      if (i) line.append(', ');
      line.append(this.sourceLink(src.title, src.url), ` (${src.site})`);
    });
  }

  /** The landmark's dated events; the ones belonging to the current era are highlighted. */
  private renderEvents(era: Era, name: string): void {
    const list = this.q('#tm-events');
    const title = this.q('#tm-eventsName');
    if (title) title.textContent = name;
    if (!list) return;
    list.replaceChildren(
      ...this.events(this.state.landmark).map((event) => {
        const target = eraForYear(event.sort);
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tm-event';
        b.classList.toggle('in-era', target === era.id);
        b.setAttribute('aria-label', `${event.year}: ${event.text} — ${this.tr('chuyển tới mốc', 'go to era')} ${target}`);
        const year = document.createElement('span');
        year.className = 'tm-event-year';
        year.textContent = event.year;
        const text = document.createElement('span');
        text.className = 'tm-event-text';
        text.textContent = event.text;
        b.append(year, text);
        b.addEventListener('click', () => {
          const index = this.eras.findIndex((e) => e.id === target);
          if (index < 0) return;
          this.state.eraIndex = index;
          const slider = this.q<HTMLInputElement>('#tm-eraSlider');
          if (slider) slider.value = String(index);
          this.render();
        });
        li.appendChild(b);
        return li;
      }),
    );
  }

  private sourceLink(text: string, url: string): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text;
    return a;
  }

  // ---------- Real / illustrated map ----------

  private wireMapMode(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MAP_MODE_KEY);
    } catch {
      // storage blocked — keep the default
    }
    this.qa_<HTMLButtonElement>('.tm-map-mode-btn').forEach((b) =>
      b.addEventListener('click', () => this.setMapMode(b.dataset['mode'] as MapMode, true)),
    );
    this.setMapMode(stored === 'illustrated' ? 'illustrated' : 'real', false);
  }

  private setMapMode(mode: MapMode, remember: boolean): void {
    this.qa_<HTMLButtonElement>('.tm-map-mode-btn').forEach((b) => {
      const on = b.dataset['mode'] === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const canvas = this.q('#tm-mapCanvas');
    const host = this.q('#tm-realMap');
    if (canvas) canvas.hidden = mode !== 'illustrated';
    if (host) host.hidden = mode !== 'real';
    if (remember) {
      try {
        localStorage.setItem(MAP_MODE_KEY, mode);
      } catch {
        // storage blocked — the choice just isn't remembered
      }
    }
    if (mode !== 'real' || !host) return;
    this.realMap ??= new TmRealMap(
      host,
      Object.keys(this.landmarks).map((key) => ({
        key,
        name: this.lm(key).name,
        lngLat: LANDMARK_INFO[key].lngLat,
        icon: landmarkIcon(key),
      })),
      (key) => {
        this.state.landmark = key;
        this.render();
      },
      this.theme.effective(),
    );
    this.realMap.select(this.state.landmark);
    void this.realMap.show();
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
          ? this.tr('Hình minh hoạ kịch bản do AI hình dung — không phải ảnh thật', 'Illustration of a scenario imagined by AI — not a real photo')
          : this.tr('Chưa có ảnh tư liệu cho mốc này — đang dùng hình minh hoạ', 'No archive photo for this era yet — showing an illustration');
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
    link.textContent = `${this.tr('Ảnh', 'Photo')}: ${photo.author} · ${photo.license}`;
    credit.append(cap, link);
  }

  private buildEraTicks(): void {
    const wrap = this.q('#tm-eraTicks');
    if (!wrap) return;
    wrap.replaceChildren();
    this.eras.forEach((era, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-era-tick';
      // Position matches the range thumb centre (see .tm-era-tick in the CSS).
      b.style.setProperty('--tm-tick-pos', String(i / Math.max(1, this.eras.length - 1)));
      const dot = document.createElement('span');
      dot.className = 'dot';
      b.appendChild(dot);
      b.appendChild(document.createTextNode(era.year));
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = this.eraTag(era);
      b.appendChild(tag);
      b.classList.toggle('active', i === this.state.eraIndex);
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

  /** Quick-pick list under the map: easier than the small pins on phones, and names every landmark. */
  private buildLandmarkList(): void {
    const list = this.q('#tm-lmList');
    if (!list) return;
    list.replaceChildren();
    Object.keys(this.landmarks).forEach((key) => {
      const lm = this.lm(key);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-lm';
      b.dataset['landmark'] = key;
      b.innerHTML = landmarkIcon(key);
      b.append(lm.name);
      b.addEventListener('click', () => {
        this.state.landmark = key;
        this.render();
      });
      list.appendChild(b);
    });
  }

  private wirePins(): void {
    this.qa_('.tm-pin').forEach((p) => {
      p.insertAdjacentHTML('afterbegin', landmarkIcon(p.dataset['landmark'] ?? ''));
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
    let pi = 0;
    this.tickerInterval = setInterval(() => {
      const phrases = this.tickerPhrases();
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

}
