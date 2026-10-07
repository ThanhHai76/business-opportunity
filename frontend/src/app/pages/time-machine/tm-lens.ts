import { LANDMARK_INFO } from './landmark-info';
import { haversineKm } from './landmark-tours';
import { TmContext } from './tm-context';

/** Within this distance the nearest landmark is selected automatically. */
const NEAR_KM = 1.5;
/** Saved photo: 3:4 like the viewfinder, plus a caption band. */
const OUT_W = 1080;
const OUT_H = 1440;
const BAND_H = 150;

const formatDistance = (km: number): string => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1)} km`);

/**
 * Time Lens: the archive photo of a landmark laid semi-transparently over the phone's camera, so the visitor
 * can line up the old view with today's and save the result. Alignment is manual (no recognition); the
 * camera image and the location never leave the device.
 */
export class TmLens {
  private stream: MediaStream | null = null;
  private opacity = 0.5;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
  ) {}

  private el<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return this.root.querySelector<T>(`#${id}`);
  }

  init(): void {
    this.el<HTMLSelectElement>('tm-lensSelect')?.addEventListener('change', (e) => this.ctx.select((e.target as HTMLSelectElement).value));
    this.el('tm-lensLocate')?.addEventListener('click', () => this.locate());
    this.el('tm-lensCamera')?.addEventListener('click', () => (this.stream ? this.stopCamera() : void this.startCamera()));
    this.el('tm-lensCapture')?.addEventListener('click', () => void this.capture());
    const slider = this.el<HTMLInputElement>('tm-lensOpacity');
    slider?.addEventListener('input', () => {
      this.opacity = Number(slider.value) / 100;
      this.el('tm-lensStage')?.style.setProperty('--lens-opacity', String(this.opacity));
    });
    this.refresh();
  }

  /** Re-reads the selected landmark and the language. Called by the page on every render. */
  refresh(): void {
    const { ctx } = this;
    const key = ctx.current();
    const select = this.el<HTMLSelectElement>('tm-lensSelect');
    if (select) {
      if (select.options.length !== ctx.keys().length || select.dataset['lang'] !== ctx.lang()) {
        select.replaceChildren(...ctx.keys().map((k) => new Option(ctx.name(k), k)));
        select.dataset['lang'] = ctx.lang();
      }
      select.value = key;
    }

    const then = ctx.thenPhoto(key);
    const img = this.el<HTMLImageElement>('tm-lensPhoto');
    const year = this.el('tm-lensYear');
    const credit = this.el('tm-lensCredit');
    if (img && then) {
      if (!img.getAttribute('src')?.endsWith(then.photo.src)) img.src = then.photo.src;
      img.alt = then.photo.alt;
      img.dataset['fit'] = then.photo.fit ?? 'cover';
    }
    if (year) year.textContent = then?.era ?? '';
    if (credit) {
      credit.replaceChildren();
      if (then) credit.append(`${then.photo.caption} — `, ctx.link(`${ctx.tr('Ảnh', 'Photo')}: ${then.photo.author} · ${then.photo.license}`, then.photo.pageUrl));
    }
    this.renderButtons();
  }

  destroy(): void {
    this.stopCamera();
  }

  private renderButtons(): void {
    const { ctx } = this;
    const live = !!this.stream;
    const camera = this.el('tm-lensCamera');
    if (camera) camera.textContent = live ? ctx.tr('Tắt camera', 'Turn camera off') : ctx.tr('Bật camera', 'Turn camera on');
    const locate = this.el('tm-lensLocate');
    if (locate) locate.textContent = ctx.tr('Tìm địa danh gần tôi', 'Find the landmark near me');
    const capture = this.el<HTMLButtonElement>('tm-lensCapture');
    if (capture) {
      capture.textContent = ctx.tr('Chụp & lưu ảnh', 'Capture & save');
      capture.disabled = !live;
    }
    const hint = this.el('tm-lensHint');
    if (hint) hint.hidden = live;
    this.el('tm-lensStage')?.classList.toggle('live', live);
  }

  private status(text: string): void {
    const el = this.el('tm-lensStatus');
    if (el) el.textContent = text;
  }

  // ---------- Location ----------

  private locate(): void {
    const { ctx } = this;
    if (!('geolocation' in navigator)) {
      this.status(ctx.tr('Trình duyệt này không hỗ trợ định vị — hãy chọn địa danh trong danh sách.', 'This browser has no location support — pick the landmark from the list.'));
      return;
    }
    this.status(ctx.tr('Đang xác định vị trí…', 'Finding your location…'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const [nearest] = ctx
          .keys()
          .map((key) => ({ key, km: haversineKm(here, LANDMARK_INFO[key].lngLat) }))
          .sort((a, b) => a.km - b.km);
        const name = ctx.name(nearest.key);
        const distance = formatDistance(nearest.km);
        if (nearest.km <= NEAR_KM) {
          ctx.select(nearest.key);
          this.status(ctx.tr(`Bạn đang cách ${name} khoảng ${distance} — đã chọn địa danh này.`, `You are about ${distance} from ${name} — it is now selected.`));
        } else {
          this.status(
            ctx.tr(
              `Địa danh gần nhất là ${name}, cách ${distance}. Ống kính dùng tốt nhất khi bạn đứng tại địa danh; bạn vẫn có thể chọn trong danh sách.`,
              `The nearest landmark is ${name}, ${distance} away. The lens works best when you stand at the landmark; you can still pick one from the list.`,
            ),
          );
        }
      },
      (err) => {
        this.status(
          err.code === err.PERMISSION_DENIED
            ? ctx.tr('Bạn chưa cho phép truy cập vị trí — hãy chọn địa danh trong danh sách.', 'Location access was not allowed — pick the landmark from the list.')
            : ctx.tr('Không xác định được vị trí — hãy chọn địa danh trong danh sách.', 'Could not get your location — pick the landmark from the list.'),
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  // ---------- Camera ----------

  private async startCamera(): Promise<void> {
    const { ctx } = this;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.status(ctx.tr('Camera chỉ dùng được khi trang chạy qua HTTPS, trên trình duyệt hỗ trợ camera.', 'The camera only works when the page is served over HTTPS, in a browser with camera support.'));
      return;
    }
    const video = this.el<HTMLVideoElement>('tm-lensVideo');
    if (!video) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = this.stream;
      await video.play();
      this.status(ctx.tr('Xoay máy cho đến khi các đường nét của ảnh xưa trùng với khung cảnh thật.', 'Move the phone until the lines of the old photo match the real view.'));
    } catch (error) {
      this.stopCamera();
      const name = error instanceof DOMException ? error.name : '';
      this.status(
        name === 'NotAllowedError'
          ? ctx.tr('Bạn chưa cho phép dùng camera.', 'Camera access was not allowed.')
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? ctx.tr('Không tìm thấy camera trên thiết bị này. Trên máy tính, hãy dùng khung Xưa & Nay ở chương 03.', 'No camera found on this device. On a computer, use the Then & Now slider in chapter 03.')
            : ctx.tr('Không mở được camera.', 'Could not open the camera.'),
      );
    }
    this.renderButtons();
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const video = this.el<HTMLVideoElement>('tm-lensVideo');
    if (video) video.srcObject = null;
    this.renderButtons();
  }

  // ---------- Capture ----------

  /** Draws `source` into the box, cropped (cover) or letterboxed (contain) like CSS object-fit. */
  private drawFit(g: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, w: number, h: number, fit: string): void {
    const scale = fit === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    g.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  private async capture(): Promise<void> {
    const { ctx } = this;
    const video = this.el<HTMLVideoElement>('tm-lensVideo');
    const img = this.el<HTMLImageElement>('tm-lensPhoto');
    const key = ctx.current();
    const then = ctx.thenPhoto(key);
    if (!this.stream || !video || !img || !then || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUT_W;
    canvas.height = OUT_H + BAND_H;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.fillStyle = '#0c0906';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.save();
    g.beginPath();
    g.rect(0, 0, OUT_W, OUT_H);
    g.clip();
    this.drawFit(g, video, video.videoWidth, video.videoHeight, OUT_W, OUT_H, 'cover');
    g.globalAlpha = this.opacity;
    this.drawFit(g, img, img.naturalWidth, img.naturalHeight, OUT_W, OUT_H, then.photo.fit ?? 'cover');
    g.restore();

    // Caption band: landmark, eras, and the archive photo's credit.
    g.fillStyle = '#f3ead9';
    g.font = '600 44px Georgia, serif';
    g.fillText(`${ctx.name(key)} · ${then.era} → ${new Date().getFullYear()}`, 40, OUT_H + 62);
    g.fillStyle = '#bcab8c';
    g.font = '24px "Courier New", monospace';
    // Shorten the credit with an ellipsis until it fits the width.
    let credit = `${ctx.tr('Ảnh xưa', 'Archive photo')}: ${then.photo.author} · ${then.photo.license}`;
    while (g.measureText(credit).width > OUT_W - 80 && credit.length > 10) credit = `${credit.slice(0, -2)}…`;
    g.fillText(credit, 40, OUT_H + 104);
    g.fillText('Wikimedia Commons · Hanoi Time Machine', 40, OUT_H + 136);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    const file = new File([blob], `hanoi-time-machine-${key}.jpg`, { type: 'image/jpeg' });
    // Phones: the share sheet (save to photos, send…). Elsewhere: a download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${ctx.name(key)} · Hanoi Time Machine` });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return; // the visitor closed the share sheet
        // sharing failed — fall back to a download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    this.status(ctx.tr('Đã lưu ảnh Xưa vs Nay.', 'Your Then vs Now photo has been saved.'));
  }
}
