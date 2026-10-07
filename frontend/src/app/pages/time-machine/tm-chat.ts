import { TIME_MACHINE_API_URL } from '../../config';
import { ChatAnswer, QA } from './tm-data';
import { TmContext } from './tm-context';
import { EN_QA } from './tm-i18n';

/** POST /api/time-machine/ask response. */
interface StorytellerAnswer {
  answer: string;
  sources: Array<{ title: string; site: string; url: string }>;
  future: boolean;
  outOfScope: boolean;
  provider: string;
  model: string | null;
}

/**
 * AI Storyteller chat: suggested questions answer with their reviewed text; anything typed goes to
 * POST /api/time-machine/ask, which answers only from the page's data and attaches the sources.
 */
export class TmChat {
  private timers: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>> = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
    private readonly reduceMotion: boolean,
  ) {}

  init(): void {
    this.refresh();
    this.wireForm();
  }

  destroy(): void {
    this.timers.forEach((t) => {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      clearInterval(t as ReturnType<typeof setInterval>);
    });
  }

  private q<T extends Element = HTMLElement>(selector: string): T | null {
    return this.root.querySelector<T>(selector);
  }

  private qaList(): ChatAnswer[] {
    return this.ctx.lang() === 'en' ? QA.map((item, i) => ({ ...item, ...EN_QA[i] })) : QA;
  }

  /** Suggested-question chips, in the current language (called again after a language switch). */
  refresh(): void {
    const chipRow = this.q('#tm-chatChips');
    if (!chipRow) return;
    chipRow.replaceChildren();
    this.qaList().forEach((item) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'tm-chip';
      c.textContent = item.q;
      c.addEventListener('click', () => this.askQuestion(item.q));
      chipRow.appendChild(c);
    });
  }

  private wireForm(): void {
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

  /** An AI bubble showing the typing dots; pass it to addAiBubble to fill it in. */
  private addTypingBubble(): HTMLElement | null {
    const log = this.q('#tm-chatLog');
    if (!log) return null;
    const b = document.createElement('div');
    b.className = 'tm-bubble tm-ai';
    b.setAttribute('aria-busy', 'true');
    const typing = document.createElement('span');
    typing.className = 'tm-typing';
    for (let i = 0; i < 3; i++) typing.appendChild(document.createElement('span'));
    b.appendChild(typing);
    log.appendChild(b);
    this.scrollChat();
    return b;
  }

  /** The grey source line under an answer, with links when the answer has sources. */
  private sourceLine(item: ChatAnswer, links: StorytellerAnswer['sources']): HTMLElement {
    const src = document.createElement('span');
    src.className = 'tm-src';
    src.textContent = item.src;
    if (links.length) {
      src.append(this.ctx.tr(' · Nguồn: ', ' · Sources: '));
      links.forEach((l, i) => {
        if (i) src.append(', ');
        src.append(this.ctx.link(l.title, l.url));
      });
    }
    return src;
  }

  private addAiBubble(item: ChatAnswer, links: StorytellerAnswer['sources'] = [], bubble?: HTMLElement | null): void {
    const log = this.q('#tm-chatLog');
    if (!log) return;
    const b = bubble ?? this.addTypingBubble();
    if (!b) return;
    b.removeAttribute('aria-busy');
    b.classList.toggle('tm-future', item.future);

    if (this.reduceMotion) {
      b.replaceChildren(document.createTextNode(item.a), this.sourceLine(item, links));
      this.scrollChat();
      return;
    }

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
          b.appendChild(this.sourceLine(item, links));
          this.scrollChat();
        }
      }, 14);
      this.timers.push(interval);
    }, bubble ? 0 : 500);
    this.timers.push(startTimeout);
  }

  /** Suggested questions use their reviewed answer; anything else goes to the AI Storyteller API. */
  private askQuestion(text: string): void {
    this.addUserBubble(text);
    const preset = this.qaList().find((item) => item.q === text);
    if (preset) {
      this.addAiBubble(preset);
      return;
    }
    void this.askStoryteller(text);
  }

  private async askStoryteller(question: string): Promise<void> {
    const bubble = this.addTypingBubble();
    const send = this.q<HTMLButtonElement>('.tm-chat-send');
    if (send) send.disabled = true;
    try {
      const res = await fetch(`${TIME_MACHINE_API_URL}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: question.slice(0, 500), landmark: this.ctx.current(), era: this.ctx.era(), lang: this.ctx.lang() }),
      });
      const data = (await res.json().catch(() => null)) as (StorytellerAnswer & { message?: string }) | null;
      if (!res.ok || !data) throw new Error(data?.message ?? `HTTP ${res.status}`);
      const src = data.outOfScope
        ? this.ctx.tr('Ngoài phạm vi dữ liệu của Time Machine', 'Outside the Time Machine’s data')
        : data.provider === 'anthropic'
          ? this.ctx.tr('AI (Claude) · chỉ dựa trên dữ liệu của trang', 'AI (Claude) · based only on this page’s data')
          : this.ctx.tr('Trả lời tự động từ dữ liệu của trang (chưa bật AI)', 'Automatic answer from this page’s data (AI not enabled)');
      const scenario = this.ctx.tr('Kịch bản tương lai, không phải dự đoán', 'Future scenario, not a prediction');
      this.addAiBubble({ q: question, a: data.answer, src: data.future ? `${src} · ${scenario}` : src, future: data.future }, data.sources, bubble);
    } catch (error) {
      const fallback = this.ctx.tr(
        'Không kết nối được AI kể chuyện. Hãy thử lại sau, hoặc chọn một câu hỏi gợi ý.',
        'Could not reach the AI Storyteller. Please try again later, or pick a suggested question.',
      );
      const message = error instanceof Error && !/^HTTP|fetch/i.test(error.message) ? error.message : fallback;
      this.addAiBubble({ q: question, a: message, src: this.ctx.tr('Lỗi kết nối', 'Connection error'), future: false }, [], bubble);
    } finally {
      if (send) send.disabled = false;
    }
  }
}
