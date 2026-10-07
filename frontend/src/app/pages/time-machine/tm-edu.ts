import { eraForYear } from './landmark-info';
import { TmContext } from './tm-context';
import { printSheet } from './tm-print';
import { EventRef, Question, buildQuestions, eventById, eventsOf, mulberry32, scopeKeys, shuffle } from './tm-quiz';

/**
 * Education mode: quizzes and a "put the events in order" game generated from the page's own dated events
 * (so every question has a source), assignment links and a printable worksheet. Progress stays in this
 * browser (localStorage); there are no accounts and no class dashboard.
 */
interface Progress {
  answered: number;
  correct: number;
  streak: number;
  lastDay: string;
  best: Record<string, number>;
}

const PROGRESS_KEY = 'hanoi100.tm.edu';
const TIMELINE_SIZE = 5;
const LETTERS = ['A', 'B', 'C', 'D'];

const randomSeed = () => Math.floor(Math.random() * 1_000_000);
const localDay = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function readProgress(): Progress {
  const empty: Progress = { answered: 0, correct: 0, streak: 0, lastDay: '', best: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as Progress | null;
    return parsed && typeof parsed.answered === 'number' ? { ...empty, ...parsed } : empty;
  } catch {
    return empty;
  }
}

export class TmEdu {
  private scope = 'all';
  private count = 10;
  private seed = randomSeed();
  private questions: Question[] = [];
  private started = false;
  private index = 0;
  private score = 0;
  private picked: number | null = null;
  private progress = readProgress();
  /** Timeline game: event ids in the order the player has arranged them. */
  private order: string[] = [];
  private checked = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: TmContext,
  ) {}

  private el<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return this.root.querySelector<T>(`#${id}`);
  }

  /** `assignment` comes from an assignment link (?quiz=&n=&seed=) and starts that quiz directly. */
  init(assignment?: { scope: string; count: number; seed: number }): void {
    const scopeSelect = this.el<HTMLSelectElement>('tm-quizScope');
    const countSelect = this.el<HTMLSelectElement>('tm-quizCount');
    scopeSelect?.addEventListener('change', () => {
      this.scope = scopeSelect.value;
      this.seed = randomSeed();
      this.newTimeline();
    });
    countSelect?.addEventListener('change', () => (this.count = Number(countSelect.value)));
    this.el('tm-quizStart')?.addEventListener('click', () => this.start(randomSeed()));
    this.el('tm-tlNew')?.addEventListener('click', () => this.newTimeline());
    this.el('tm-tlCheck')?.addEventListener('click', () => {
      this.checked = true;
      this.renderTimeline();
    });
    this.el('tm-eduLink')?.addEventListener('click', () => this.showLink());
    this.el('tm-eduCopy')?.addEventListener('click', () => void this.copyLink());
    this.el('tm-eduPrint')?.addEventListener('click', () => this.printWorksheet());

    if (assignment && this.scopeKeys(assignment.scope).length) {
      this.scope = assignment.scope;
      this.count = assignment.count;
      this.start(assignment.seed);
    }
    this.newTimeline();
    this.refresh();
  }

  /** Language changed: rebuild every text from the same seeds, keeping the player's place. */
  refresh(): void {
    const { ctx } = this;
    const scopeSelect = this.el<HTMLSelectElement>('tm-quizScope');
    if (scopeSelect) {
      const all = new Option(ctx.tr(`Tất cả ${ctx.keys().length} địa danh`, `All ${ctx.keys().length} landmarks`), 'all');
      const tours = document.createElement('optgroup');
      tours.label = ctx.tr('Tuyến tham quan', 'Walking tours');
      ctx.tours().forEach((t) => tours.appendChild(new Option(t.name, `tour:${t.id}`)));
      const landmarks = document.createElement('optgroup');
      landmarks.label = ctx.tr('Một địa danh', 'One landmark');
      ctx.keys().forEach((k) => landmarks.appendChild(new Option(ctx.name(k), `lm:${k}`)));
      scopeSelect.replaceChildren(all, tours, landmarks);
      scopeSelect.value = this.scope;
    }
    const countSelect = this.el<HTMLSelectElement>('tm-quizCount');
    if (countSelect) countSelect.value = String(this.count);
    this.renderQuiz();
    this.renderTimeline();
    this.renderProgress();
  }

  // ---------- Data ----------

  private scopeKeys(scope: string): string[] {
    return scopeKeys(this.ctx, scope);
  }

  private eventsOf(keys: string[]): EventRef[] {
    return eventsOf(this.ctx, keys);
  }

  private scopeLabel(scope: string): string {
    const { ctx } = this;
    if (scope.startsWith('lm:')) return ctx.name(scope.slice(3));
    if (scope.startsWith('tour:')) return ctx.tours().find((t) => t.id === scope.slice(5))?.name ?? scope;
    return ctx.tr('Tất cả địa danh', 'All landmarks');
  }

  private buildQuestions(scope: string, count: number, seed: number): Question[] {
    return buildQuestions(this.ctx, scope, count, seed);
  }

  /** The question's wording and options in the current language. */
  private words(q: Question): { event: EventRef; prompt: string; options: string[] } {
    const { ctx } = this;
    const event = this.eventById(q.eventId)!;
    const name = ctx.name(event.key);
    const prompt =
      q.kind === 'year'
        ? ctx.tr(`${name}: “${event.text}”. Sự kiện này diễn ra năm nào?`, `${name}: “${event.text}”. In which year did this happen?`)
        : ctx.tr(`${event.year}: “${event.text}”. Sự kiện này gắn với địa danh nào?`, `${event.year}: “${event.text}”. Which landmark is this about?`);
    const options = q.kind === 'year' ? q.values : q.values.map((k) => ctx.name(k));
    return { event, prompt, options };
  }

  // ---------- Quiz ----------

  private start(seed: number): void {
    this.seed = seed;
    this.started = true;
    this.index = 0;
    this.score = 0;
    this.picked = null;
    this.questions = this.buildQuestions(this.scope, this.count, this.seed);
    this.renderQuiz();
  }

  private answer(option: number): void {
    if (this.picked !== null) return;
    this.picked = option;
    const right = option === this.questions[this.index].answer;
    if (right) this.score++;
    const p = this.progress;
    const today = localDay();
    if (p.lastDay !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      p.streak = p.lastDay === localDay(yesterday) ? p.streak + 1 : 1;
      p.lastDay = today;
    }
    p.answered++;
    if (right) p.correct++;
    if (this.index === this.questions.length - 1) {
      const pct = Math.round((this.score / this.questions.length) * 100);
      p.best[this.scope] = Math.max(p.best[this.scope] ?? 0, pct);
    }
    this.saveProgress();
    this.renderQuiz();
    this.renderProgress();
  }

  private next(): void {
    this.index++;
    this.picked = null;
    this.renderQuiz();
  }

  private button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  private para(text: string, cls: string): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  private renderQuiz(): void {
    const { ctx } = this;
    const box = this.el('tm-quizBox');
    if (!box) return;
    if (!this.started) {
      box.replaceChildren(
        this.para(
          ctx.tr('Chọn chủ đề và bấm Bắt đầu. Mỗi câu hỏi được lấy từ một mốc sự kiện có nguồn trên trang.', 'Pick a topic and press Start. Every question comes from a sourced key event on this page.'),
          'tm-edu-help',
        ),
      );
      return;
    }
    if (!this.questions.length) {
      box.replaceChildren(this.para(ctx.tr('Chủ đề này chưa đủ dữ liệu để tạo câu hỏi.', 'Not enough data on this topic for questions yet.'), 'tm-edu-help'));
      return;
    }
    if (this.index >= this.questions.length) {
      const pct = Math.round((this.score / this.questions.length) * 100);
      const best = this.progress.best[this.scope] ?? pct;
      box.replaceChildren(
        this.para(ctx.tr(`Bạn đúng ${this.score}/${this.questions.length} câu (${pct}%).`, `You got ${this.score}/${this.questions.length} right (${pct}%).`), 'tm-quiz-score'),
        this.para(ctx.tr(`Kết quả tốt nhất với chủ đề này: ${best}%`, `Your best on this topic: ${best}%`), 'tm-edu-help'),
        this.row(
          this.button(ctx.tr('Làm lại đề này', 'Retry this quiz'), 'tm-btn tm-btn-ghost', () => this.start(this.seed)),
          this.button(ctx.tr('Đề mới', 'New quiz'), 'tm-btn tm-btn-primary', () => this.start(randomSeed())),
        ),
      );
      return;
    }

    const q = this.questions[this.index];
    const { event, prompt: promptText, options: optionTexts } = this.words(q);
    const head = this.para(
      ctx.tr(`Câu ${this.index + 1}/${this.questions.length} · Điểm ${this.score}`, `Question ${this.index + 1}/${this.questions.length} · Score ${this.score}`),
      'tm-quiz-head',
    );
    const prompt = this.para(promptText, 'tm-quiz-prompt');
    const options = document.createElement('div');
    options.className = 'tm-quiz-options';
    optionTexts.forEach((text, i) => {
      const b = this.button(`${LETTERS[i]}. ${text}`, 'tm-quiz-opt', () => this.answer(i));
      if (this.picked !== null) {
        b.disabled = true;
        if (i === q.answer) b.classList.add('right');
        else if (i === this.picked) b.classList.add('wrong');
      }
      options.appendChild(b);
    });
    const parts: Node[] = [head, prompt, options];
    if (this.picked !== null) {
      const right = this.picked === q.answer;
      const answerText = optionTexts[q.answer];
      const feedback = this.para(right ? ctx.tr('✓ Chính xác!', '✓ Correct!') : ctx.tr(`✗ Chưa đúng — đáp án: ${answerText}`, `✗ Not quite — the answer is ${answerText}`), right ? 'tm-quiz-feedback right' : 'tm-quiz-feedback wrong');
      const explain = this.para(`${event.year} · ${ctx.name(event.key)}: ${event.text}.`, 'tm-edu-help');
      const see = this.button(ctx.tr('Xem trong dòng thời gian ↑', 'See it on the timeline ↑'), 'tm-quiz-link', () => {
        ctx.select(event.key, eraForYear(event.sort));
        this.root.querySelector('#tm-timeline')?.scrollIntoView({ behavior: 'smooth' });
      });
      const last = this.index === this.questions.length - 1;
      parts.push(feedback, explain, this.row(see, this.button(last ? ctx.tr('Xem kết quả', 'See results') : ctx.tr('Câu tiếp →', 'Next →'), 'tm-btn tm-btn-primary', () => this.next())));
    }
    box.replaceChildren(...parts);
  }

  private row(...children: Node[]): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'tm-edu-row';
    div.append(...children);
    return div;
  }

  // ---------- Timeline game ----------

  private timelinePool(): EventRef[] {
    const inScope = this.eventsOf(this.scopeKeys(this.scope));
    return new Set(inScope.map((e) => e.sort)).size >= TIMELINE_SIZE - 1 ? inScope : this.eventsOf(this.ctx.keys());
  }

  private newTimeline(): void {
    const rng = mulberry32(randomSeed());
    const bySort = new Map<number, EventRef>();
    for (const e of shuffle(this.timelinePool(), rng)) if (!bySort.has(e.sort)) bySort.set(e.sort, e);
    const chosen = [...bySort.values()].slice(0, TIMELINE_SIZE);
    // Never start already sorted.
    let order = shuffle(chosen, rng);
    while (order.length > 1 && order.every((e, i) => i === 0 || order[i - 1].sort <= e.sort)) order = shuffle(chosen, rng);
    this.order = order.map((e) => e.id);
    this.checked = false;
    this.renderTimeline();
  }

  private eventById(id: string): EventRef | undefined {
    return eventById(this.ctx, id);
  }

  private move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= this.order.length) return;
    [this.order[index], this.order[target]] = [this.order[target], this.order[index]];
    this.checked = false;
    this.renderTimeline();
    this.el('tm-tlList')?.querySelectorAll<HTMLButtonElement>('.tm-tl-move')[target * 2 + (delta < 0 ? 0 : 1)]?.focus();
  }

  private renderTimeline(): void {
    const { ctx } = this;
    const list = this.el('tm-tlList');
    const result = this.el('tm-tlResult');
    if (!list) return;
    const events = this.order.map((id) => this.eventById(id)).filter((e): e is EventRef => !!e);
    const sorted = [...events].sort((a, b) => a.sort - b.sort);
    list.replaceChildren(
      ...events.map((e, i) => {
        const li = document.createElement('li');
        li.className = 'tm-tl-item';
        if (this.checked) li.classList.add(sorted[i].id === e.id ? 'right' : 'wrong');
        const text = document.createElement('span');
        text.className = 'tm-tl-text';
        text.textContent = `${ctx.name(e.key)}: ${e.text}`;
        if (this.checked) {
          const year = document.createElement('b');
          year.className = 'tm-tl-year';
          year.textContent = e.year;
          li.append(year);
        }
        const up = this.button('↑', 'tm-tl-move', () => this.move(i, -1));
        up.setAttribute('aria-label', ctx.tr('Đưa lên', 'Move up'));
        up.disabled = i === 0;
        const down = this.button('↓', 'tm-tl-move', () => this.move(i, 1));
        down.setAttribute('aria-label', ctx.tr('Đưa xuống', 'Move down'));
        down.disabled = i === events.length - 1;
        li.append(text, up, down);
        return li;
      }),
    );
    if (!result) return;
    if (!this.checked) {
      result.textContent = '';
      return;
    }
    const right = events.filter((e, i) => sorted[i].id === e.id).length;
    result.textContent =
      right === events.length
        ? ctx.tr('Chính xác! Tất cả đã đúng thứ tự.', 'Correct! Everything is in order.')
        : ctx.tr(`Đúng ${right}/${events.length} vị trí. Thứ tự đúng: ${sorted.map((e) => e.year).join(' → ')}`, `${right}/${events.length} in the right place. Correct order: ${sorted.map((e) => e.year).join(' → ')}`);
  }

  // ---------- Progress ----------

  private saveProgress(): void {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(this.progress));
    } catch {
      // storage blocked — progress lasts for this visit only
    }
  }

  private renderProgress(): void {
    const { ctx } = this;
    const box = this.el('tm-eduProgress');
    if (!box) return;
    const p = this.progress;
    const pill = (text: string) => {
      const span = document.createElement('span');
      span.className = 'tm-xp-pill';
      span.textContent = text;
      return span;
    };
    if (!p.answered) {
      box.replaceChildren(pill(ctx.tr('Chưa có tiến độ trên máy này', 'No progress on this device yet')));
      return;
    }
    const pct = Math.round((p.correct / p.answered) * 100);
    box.replaceChildren(
      pill(ctx.tr(`Đã trả lời ${p.answered} câu · đúng ${pct}%`, `${p.answered} answered · ${pct}% correct`)),
      pill(ctx.tr(`🔥 Chuỗi ngày học: ${p.streak}`, `🔥 Day streak: ${p.streak}`)),
    );
  }

  // ---------- Teachers ----------

  private assignmentUrl(): string {
    const params = new URLSearchParams({ quiz: this.scope, n: String(this.count), seed: String(this.seed), lang: this.ctx.lang() });
    return `${location.origin}${location.pathname}?${params.toString()}#tm-education`;
  }

  private showLink(): void {
    // A fresh quiz for the assignment unless one is under way, so the link matches what the teacher sees.
    if (!this.started) this.start(randomSeed());
    const box = this.el('tm-eduLinkBox');
    const out = this.el<HTMLInputElement>('tm-eduLinkOut');
    if (!box || !out) return;
    out.value = this.assignmentUrl();
    box.hidden = false;
    out.select();
  }

  private async copyLink(): Promise<void> {
    const out = this.el<HTMLInputElement>('tm-eduLinkOut');
    const copy = this.el('tm-eduCopy');
    if (!out || !copy) return;
    try {
      await navigator.clipboard.writeText(out.value);
    } catch {
      out.select();
      document.execCommand?.('copy');
    }
    copy.textContent = this.ctx.tr('Đã chép ✓', 'Copied ✓');
    setTimeout(() => (copy.textContent = this.ctx.tr('Sao chép', 'Copy')), 2000);
  }

  /** A print-only worksheet: questions, the timeline task, and the answer key on its own page. */
  private printWorksheet(): void {
    const { ctx } = this;
    if (!this.started) this.start(randomSeed());
    const questions = this.questions;
    const timeline = this.order.map((id) => this.eventById(id)).filter((e): e is EventRef => !!e);

    const sheet = document.createElement('div');
    const add = (tag: string, text: string, cls = '') => {
      const el = document.createElement(tag);
      el.textContent = text;
      if (cls) el.className = cls;
      sheet.appendChild(el);
      return el;
    };
    add('h1', ctx.tr('Hanoi Time Machine — Phiếu học tập', 'Hanoi Time Machine — Worksheet'));
    add('p', `${ctx.tr('Chủ đề', 'Topic')}: ${this.scopeLabel(this.scope)} · ${ctx.tr('Mã đề', 'Quiz code')}: ${this.seed}`);
    add('p', ctx.tr('Họ tên: ______________________   Lớp: ________   Ngày: ________', 'Name: ______________________   Class: ________   Date: ________'), 'tm-ws-lines');
    add('h2', ctx.tr('Phần 1 — Chọn đáp án đúng', 'Part 1 — Choose the right answer'));
    const ol = document.createElement('ol');
    questions.forEach((q) => {
      const { prompt, options } = this.words(q);
      const li = document.createElement('li');
      li.append(prompt);
      const opts = document.createElement('div');
      opts.className = 'tm-ws-opts';
      opts.textContent = options.map((o, i) => `${LETTERS[i]}. ${o}`).join('     ');
      li.appendChild(opts);
      ol.appendChild(li);
    });
    sheet.appendChild(ol);
    add('h2', ctx.tr('Phần 2 — Đánh số 1 đến 5 theo thứ tự thời gian', 'Part 2 — Number the events 1 to 5 in time order'));
    const ul = document.createElement('ul');
    ul.className = 'tm-ws-timeline';
    timeline.forEach((e) => {
      const li = document.createElement('li');
      li.textContent = `[   ]  ${ctx.name(e.key)}: ${e.text}`;
      ul.appendChild(li);
    });
    sheet.appendChild(ul);
    add('p', ctx.tr('Nguồn: câu chuyện và các mốc sự kiện trên Hanoi Time Machine (tóm tắt từ Wikipedia, trang chính thức của di tích, UNESCO).', 'Source: stories and key events on Hanoi Time Machine (summarised from Wikipedia, official relic sites, UNESCO).'), 'tm-ws-source');

    add('h2', ctx.tr('Đáp án', 'Answer key'), 'tm-ws-break');
    const key = document.createElement('ol');
    questions.forEach((q) => {
      const { event, options } = this.words(q);
      const li = document.createElement('li');
      li.textContent = `${LETTERS[q.answer]}. ${options[q.answer]} (${q.kind === 'year' ? ctx.name(event.key) : event.year})`;
      key.appendChild(li);
    });
    sheet.appendChild(key);
    const sorted = [...timeline].sort((a, b) => a.sort - b.sort);
    add('p', `${ctx.tr('Phần 2', 'Part 2')}: ${sorted.map((e) => `${e.year} — ${ctx.name(e.key)}: ${e.text}`).join(' → ')}`);

    printSheet(sheet);
  }
}
