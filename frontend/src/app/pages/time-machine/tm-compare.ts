import { LandmarkPhoto } from './time-machine-photos';
import { landmarkIcon } from './landmark-icons';
import { TmContext } from './tm-context';

/** "Then & Now": the oldest archive photo over today's, with a draggable divider. */
export class TmCompare {
  private compareKey = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
  ) {}

  init(): void {
    this.refresh();
    this.wireRange();
  }

  /** Language changed: rebuild the chips and captions. */
  refresh(): void {
    this.buildChips();
    this.render();
  }

  private q<T extends Element = HTMLElement>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }

  private comparePair(key: string): { then: LandmarkPhoto; thenEra: string; now: LandmarkPhoto } | null {
    const then = this.ctx.thenPhoto(key);
    const now = this.ctx.photo(key, '2026');
    return then && now ? { then: then.photo, thenEra: then.era, now } : null;
  }

  /** Chips for every landmark with a photo pair, in the current language. */
  private buildChips(): void {
    const chips = this.q('#tm-cmpChips');
    if (!chips) return;
    chips.replaceChildren();
    this.ctx.keys().forEach((key) => {
      if (!this.comparePair(key)) return;
      this.compareKey ||= key;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tm-lm';
      b.dataset['cmp'] = key;
      b.innerHTML = landmarkIcon(key);
      b.append(this.ctx.name(key));
      b.addEventListener('click', () => {
        this.compareKey = key;
        this.ctx.select(key);
      });
      chips.appendChild(b);
    });
  }

  private wireRange(): void {
    const range = this.q<HTMLInputElement>('#tm-cmpRange');
    const frame = this.q('#tm-cmp');
    range?.addEventListener('input', () => frame?.style.setProperty('--pos', `${range.value}%`));
  }

  /** Follows the page's selected landmark (when it has a photo pair). */
  render(): void {
    if (this.comparePair(this.ctx.current())) this.compareKey = this.ctx.current();
    const pair = this.comparePair(this.compareKey);
    const oldImg = this.q<HTMLImageElement>('#tm-cmpOld');
    const nowImg = this.q<HTMLImageElement>('#tm-cmpNow');
    const credits = this.q('#tm-cmpCredits');
    const empty = this.q('#tm-cmpEmpty');
    if (!pair || !oldImg || !nowImg || !credits || !empty) return;

    const shown = this.ctx.name(this.compareKey);
    const selected = this.ctx.name(this.ctx.current());
    empty.hidden = this.ctx.current() === this.compareKey;
    empty.textContent = this.ctx.tr(`Chưa có đủ ảnh xưa và nay cho ${selected} — đang hiển thị ${shown}.`, `No then-and-now photo pair for ${selected} yet — showing ${shown}.`);

    Array.from(this.root.querySelectorAll<HTMLElement>('.tm-cmp-chips .tm-lm')).forEach((c) => {
      const on = c.dataset['cmp'] === this.compareKey;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', String(on));
    });

    const setImg = (img: HTMLImageElement, photo: LandmarkPhoto) => {
      if (!img.getAttribute('src')?.endsWith(photo.src)) img.src = photo.src;
      img.alt = photo.alt;
      img.dataset['fit'] = photo.fit ?? 'cover';
      img.style.objectPosition = photo.position ?? '50% 50%';
    };
    setImg(oldImg, pair.then);
    setImg(nowImg, pair.now);
    const oldLabel = this.q('#tm-cmpOldLabel');
    if (oldLabel) oldLabel.textContent = pair.thenEra;

    const creditLine = (year: string, photo: LandmarkPhoto) => {
      const line = document.createElement('p');
      line.append(`${year} · ${photo.caption} — `, this.ctx.link(`${this.ctx.tr('Ảnh', 'Photo')}: ${photo.author} · ${photo.license}`, photo.pageUrl));
      return line;
    };
    credits.replaceChildren(creditLine(pair.thenEra, pair.then), creditLine('2026', pair.now));
  }
}
