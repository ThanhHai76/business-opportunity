import { TmContext } from './tm-context';
import { printSheet } from './tm-print';

/**
 * Museum mode: one plaque per landmark with a real QR code that opens the page on that landmark, a download
 * of the code (SVG) and a printable A4 plaque. The QR library is only loaded when the chapter scrolls into view.
 */
export class TmMuseum {
  private qr?: typeof import('qrcode');
  private observer?: IntersectionObserver;
  /** Bumped on every rebuild, so a slow QR render from an older build doesn't overwrite a newer one. */
  private build = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
  ) {}

  init(): void {
    const chapter = this.root.querySelector('#tm-museum');
    if (!chapter) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.observer?.disconnect();
        void import('qrcode').then((qr) => {
          this.qr = qr;
          this.refresh();
        });
      },
      { rootMargin: '400px 0px' },
    );
    this.observer.observe(chapter);
    this.refresh();
  }

  destroy(): void {
    this.observer?.disconnect();
  }

  /** (Re)builds the plaques in the current language; the QR codes follow once the library is loaded. */
  refresh(): void {
    const { ctx } = this;
    const grid = this.root.querySelector('#tm-plaques');
    if (!grid) return;
    const build = ++this.build;
    grid.replaceChildren(
      ...ctx.keys().map((key) => {
        const card = document.createElement('div');
        card.className = 'tm-glass tm-plaque';
        const top = document.createElement('div');
        top.className = 'tm-plaque-top';
        const titles = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.textContent = ctx.name(key);
        const sub = document.createElement('p');
        sub.className = 'tm-loc';
        sub.textContent = ctx.sub(key);
        titles.append(h4, sub);
        const qr = document.createElement('div');
        qr.className = 'tm-qr';
        qr.setAttribute('role', 'img');
        qr.setAttribute('aria-label', ctx.tr(`Mã QR mở ${ctx.name(key)}`, `QR code opening ${ctx.name(key)}`));
        top.append(titles, qr);

        const actions = document.createElement('div');
        actions.className = 'tm-edu-row';
        const download = this.button(ctx.tr('Tải mã QR', 'Download QR'), () => void this.download(key));
        const print = this.button(ctx.tr('In biển', 'Print plaque'), () => void this.print(key));
        const open = ctx.link(ctx.tr('Mở thử ↗', 'Try it ↗'), ctx.landmarkUrl(key));
        open.className = 'tm-quiz-link';
        actions.append(download, print, open);
        card.append(top, actions);
        if (this.qr) void this.svg(key).then((svg) => build === this.build && (qr.innerHTML = svg));
        return card;
      }),
    );
    const note = this.root.querySelector('#tm-plaqueNote');
    if (note) {
      note.textContent = ctx.tr(
        `Mã QR trỏ tới địa chỉ hiện tại của trang (${location.host}). Khi đưa trang lên tên miền chính thức, hãy tải và in lại mã.`,
        `The QR codes point to the page’s current address (${location.host}). Once the page is on its final domain, download and print them again.`,
      );
    }
  }

  private button(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tm-btn tm-btn-ghost';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  /** SVG markup from the qrcode library (trusted output, safe to use as innerHTML). */
  private async svg(key: string): Promise<string> {
    this.qr ??= await import('qrcode');
    return this.qr.toString(this.ctx.landmarkUrl(key), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#171009', light: '#ffffff' } });
  }

  private async download(key: string): Promise<void> {
    const blob = new Blob([await this.svg(key)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hanoi-time-machine-qr-${key}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }

  /** An A4 plaque: name, subtitle, a large QR code, the link, and a line on what scanning does. */
  private async print(key: string): Promise<void> {
    const { ctx } = this;
    const sheet = document.createElement('div');
    sheet.classList.add('tm-print-plaque');
    const title = document.createElement('h1');
    title.textContent = ctx.name(key);
    const sub = document.createElement('p');
    sub.className = 'tm-pp-sub';
    sub.textContent = ctx.sub(key);
    const qr = document.createElement('div');
    qr.className = 'tm-pp-qr';
    qr.innerHTML = await this.svg(key);
    const call = document.createElement('p');
    call.className = 'tm-pp-call';
    call.textContent = ctx.tr('Quét mã để xem nơi này qua 6 mốc thời gian, 1926 → 2100', 'Scan to see this place across 6 eras, 1926 → 2100');
    const link = document.createElement('p');
    link.className = 'tm-pp-url';
    link.textContent = ctx.landmarkUrl(key);
    const brand = document.createElement('p');
    brand.className = 'tm-pp-brand';
    brand.textContent = 'Hanoi Time Machine — Then · Now · Next';
    sheet.append(title, sub, qr, call, link, brand);
    printSheet(sheet);
  }
}
