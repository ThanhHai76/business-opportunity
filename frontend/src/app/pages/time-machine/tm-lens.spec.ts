import { TmContext } from './tm-context';
import { TmLens } from './tm-lens';

const PAGE = `
  <div id="tm-lensStage"><video id="tm-lensVideo"></video><img id="tm-lensUser"><img id="tm-lensPhoto"><p id="tm-lensHint"></p></div>
  <select id="tm-lensSelect"></select>
  <button id="tm-lensLocate"></button><button id="tm-lensCamera"></button><button id="tm-lensCapture"></button>
  <input type="file" id="tm-lensFile" hidden>
  <p id="tm-lensMode" hidden></p><p id="tm-lensStatus"></p><input type="range" id="tm-lensOpacity" value="50">`;

const ctx = {
  lang: () => 'vi',
  tr: (vi: string) => vi,
  keys: () => ['a'],
  name: () => 'A',
  current: () => 'a',
  thenPhoto: () => null,
} as unknown as TmContext;

describe('Time Lens without a camera', () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaDevices');
  let root: HTMLElement;

  const setDevices = (devices: Array<{ kind: string }> | null) =>
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: devices === null ? undefined : { getUserMedia: () => Promise.reject(new DOMException('', 'NotFoundError')), enumerateDevices: () => Promise.resolve(devices) },
    });

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = PAGE;
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
    delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    if (original) Object.defineProperty(Navigator.prototype, 'mediaDevices', original);
  });

  const camera = () => root.querySelector('#tm-lensCamera') as HTMLButtonElement;
  const mode = () => root.querySelector('#tm-lensMode') as HTMLElement;
  const settle = () => new Promise((r) => setTimeout(r));

  it('offers the visitor’s own photo, before any click, when the browser has no camera support', async () => {
    setDevices(null);
    const lens = new TmLens(root, ctx);
    lens.init();
    await settle();
    expect(camera().textContent).toContain('Chọn ảnh hiện nay');
    expect(mode().hidden).toBeFalse();
    expect((root.querySelector('#tm-lensCapture') as HTMLButtonElement).disabled).toBeTrue();
    lens.destroy();
  });

  it('offers it when the device lists no video input', async () => {
    setDevices([{ kind: 'audioinput' }]);
    const lens = new TmLens(root, ctx);
    lens.init();
    await settle();
    expect(camera().textContent).toContain('Chọn ảnh hiện nay');
    lens.destroy();
  });

  it('keeps the camera button when the device lists a camera, or says nothing', async () => {
    for (const devices of [[{ kind: 'videoinput' }], []]) {
      setDevices(devices);
      const lens = new TmLens(root, ctx);
      lens.init();
      await settle();
      expect(camera().textContent).toBe('Bật camera');
      expect(mode().hidden).toBeTrue();
      lens.destroy();
    }
  });

  it('switches to the photo offer when opening the camera finds none', async () => {
    setDevices([]);
    const lens = new TmLens(root, ctx);
    lens.init();
    await settle();
    camera().click();
    await settle();
    expect(camera().textContent).toContain('Chọn ảnh hiện nay');
    expect(root.querySelector('#tm-lensStatus')!.textContent).toContain('Không tìm thấy camera');
    lens.destroy();
  });
});
