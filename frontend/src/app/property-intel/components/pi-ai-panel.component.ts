import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, effect, inject, input, signal } from '@angular/core';
import { AskIntent } from '../pi.models';
import { PiStateService } from '../pi.service';

interface QuickAction {
  label: string;
  intent: AskIntent;
  question: (district: string) => string;
}

const ACTIONS: QuickAction[] = [
  { label: 'Analyze Area', intent: 'analyze', question: (d) => `Is ${d} a good area to buy property for the next 5 years?` },
  { label: 'Compare Areas', intent: 'compare', question: (d) => `Compare ${d} with the top-ranked districts` },
  { label: 'Price Analysis', intent: 'price', question: (d) => `How are property prices moving in ${d}?` },
  { label: 'Future Scenario', intent: 'future', question: (d) => `What are the 5-year scenarios for ${d}?` },
  { label: 'Investment Report', intent: 'report', question: (d) => `Write an investment brief for ${d}` },
];

/** "Ask Property AI" — the floating analyst panel of the Map Intelligence dashboard. */
@Component({
  selector: 'pi-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pi-ai-panel.component.css',
  template: `
    <section class="ai" aria-label="Ask Property AI">
      <header class="ai__head">
        <span class="ai__mark" aria-hidden="true"><i></i></span>
        <div class="ai__title">
          <strong>Ask Property AI</strong>
          <span>Rule-based analyst · sample data · planning to 2045</span>
        </div>
        <kbd>{{ isMac ? '⌘J' : 'Ctrl J' }}</kbd>
      </header>

      <div class="ai__log" #log aria-live="polite">
        @if (!state.chat().length) {
          <div class="ai__empty">
            <p>Ask about any district or project in Hà Nội — growth, prices, scenarios or a head-to-head comparison.</p>
            <button type="button" class="ai__suggest" (click)="state.ask(actions[0].question(districtName()), 'analyze')">
              {{ actions[0].question(districtName()) }}
            </button>
          </div>
        }
        @for (turn of state.chat(); track turn.id) {
          <div class="ai__q">{{ turn.question }}</div>
          @if (turn.error) {
            <div class="ai__error" role="alert">{{ turn.error }}</div>
          } @else if (!turn.answer) {
            <div class="ai__thinking" aria-label="Analysing"><i></i><i></i><i></i></div>
          } @else {
            @let a = turn.answer;
            <article class="ai__a">
              <div class="ai__rule">
                <span class="ai__tag">AI INSIGHT</span>
                <span class="ai__line"></span>
                <span class="ai__outlook" [attr.data-tone]="a.outlook.tone">{{ a.outlook.label }}</span>
              </div>
              <p class="ai__summary">{{ a.summary }}</p>

              @if (a.table) {
                <div class="ai__table" role="table">
                  <div class="ai__tr ai__tr--head" role="row">
                    @for (c of a.table.columns; track $index) {
                      <span role="columnheader">{{ c }}</span>
                    }
                  </div>
                  @for (row of a.table.rows; track $index; let i = $index) {
                    <div class="ai__tr" role="row" [class.is-top]="i === a.table.highlight">
                      @for (cell of row; track $index) {
                        <span role="cell">{{ cell }}</span>
                      }
                    </div>
                  }
                </div>
              }

              <dl class="ai__rows">
                @for (r of a.rows; track r.label) {
                  <div [class]="'pi-tone-' + r.tone">
                    <dt>{{ r.label }}</dt>
                    <dd>{{ r.text }}</dd>
                  </div>
                }
              </dl>

              @if (a.scenarios?.length) {
                <div class="ai__scenarios">
                  @for (s of a.scenarios; track s.key) {
                    <div class="ai__scenario" [attr.data-kind]="s.key">
                      <span class="ai__scenario-k">{{ s.label?.toUpperCase() }} · {{ s.probability }}%</span>
                      <span class="ai__scenario-v">{{ s.change > 0 ? '+' : '' }}{{ s.change }}%</span>
                      <span class="ai__scenario-n">{{ s.note }}</span>
                    </div>
                  }
                </div>
              }

              @if (a.callout) {
                <div class="ai__callout">
                  <span>{{ a.callout.title.toUpperCase() }}</span>
                  <p>{{ a.callout.text }}</p>
                </div>
              }
            </article>
          }
        }
      </div>

      <footer class="ai__foot">
        <div class="ai__actions">
          @for (action of actions; track action.label; let first = $first) {
            <button type="button" [class.is-primary]="first" [disabled]="state.asking()" (click)="run(action)">{{ action.label }}</button>
          }
        </div>
        <form class="ai__input" (submit)="$event.preventDefault(); send()">
          <input
            #input
            type="text"
            maxlength="500"
            placeholder="Ask about any area, project or address…"
            aria-label="Ask Property AI"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          />
          <button type="submit" aria-label="Send" [disabled]="!draft().trim() || state.asking()">↑</button>
        </form>
      </footer>
    </section>
  `,
})
export class PiAiPanelComponent {
  protected readonly state = inject(PiStateService);
  readonly districtName = input('Gia Lâm');

  @ViewChild('log', { static: true }) private log!: ElementRef<HTMLDivElement>;
  @ViewChild('input', { static: true }) private inputEl!: ElementRef<HTMLInputElement>;

  protected readonly actions = ACTIONS;
  protected readonly draft = signal('');
  protected readonly isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  constructor() {
    // Keep the newest exchange in view.
    effect(() => {
      this.state.chat();
      setTimeout(() => {
        const el = this.log.nativeElement;
        const last = Array.from(el.querySelectorAll<HTMLElement>('.ai__q')).at(-1);
        el.scrollTo({ top: last ? last.offsetTop - 8 : el.scrollHeight, behavior: 'smooth' });
      });
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      this.inputEl.nativeElement.focus();
    }
  }

  protected run(action: QuickAction): void {
    this.state.ask(action.question(this.districtName()), action.intent);
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.state.ask(text);
    this.draft.set('');
  }
}
