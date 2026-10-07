import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { AskIntent } from '../pi.models';
import { PiStateService } from '../pi.service';

const ACTIONS: Exclude<AskIntent, 'project'>[] = ['analyze', 'compare', 'future', 'price', 'report'];

/** "Ask Property AI" — the floating analyst panel of the Map Intelligence dashboard. */
@Component({
  selector: 'pi-ai-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './pi-ai-panel.component.css',
  template: `
    @let tx = state.t();
    <section class="ai" [attr.aria-label]="tx.ai.title">
      <header class="ai__head">
        <span class="ai__mark" aria-hidden="true"><i></i></span>
        <div class="ai__title">
          <strong>{{ tx.ai.title }}</strong>
          <span>{{ tx.ai.sub(usesClaude()) }}</span>
        </div>
        <kbd>{{ isMac ? '⌘J' : 'Ctrl J' }}</kbd>
      </header>

      <div class="ai__log" #log aria-live="polite">
        @if (!state.chat().length) {
          <div class="ai__empty">
            <p>{{ tx.ai.empty }}</p>
            @if (wardName()) {
              <button type="button" class="ai__suggest" (click)="run('analyze')">{{ tx.ai.questions.analyze(wardName()) }}</button>
            }
          </div>
        }
        @for (turn of state.chat(); track turn.id) {
          <div class="ai__q">{{ turn.question }}</div>
          @if (turn.error) {
            <div class="ai__error" role="alert">{{ turn.error }}</div>
          } @else if (!turn.answer) {
            <div class="ai__thinking" [attr.aria-label]="tx.ai.thinking"><i></i><i></i><i></i></div>
          } @else {
            @let a = turn.answer;
            <article class="ai__a">
              <div class="ai__rule">
                <span class="ai__tag">{{ tx.ai.insight }}</span>
                <span class="ai__line"></span>
                <span class="ai__outlook" [attr.data-tone]="a.outlook.tone">{{ a.outOfScope ? tx.ai.outOfScope : a.outlook.label }}</span>
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
                @for (r of a.rows; track $index) {
                  <div [class]="'pi-tone-' + r.tone">
                    <dt>{{ r.label }}</dt>
                    <dd>{{ r.text }}</dd>
                  </div>
                }
              </dl>

              @if (a.callout) {
                <div class="ai__callout">
                  <span>{{ a.callout.title.toUpperCase() }}</span>
                  <p>{{ a.callout.text }}</p>
                </div>
              }

              @if (a.sources.length) {
                <details class="ai__sources">
                  <summary>{{ tx.ai.sources }} ({{ a.sources.length }})</summary>
                  <ul>
                    @for (s of a.sources; track s.id) {
                      <li>
                        @if (s.url) {
                          <a [href]="s.url" target="_blank" rel="noopener">{{ s.title }}</a>
                        } @else {
                          {{ s.title }}
                        }
                      </li>
                    }
                  </ul>
                </details>
              }

              @if ($last && a.followUps.length) {
                <div class="ai__follow">
                  @for (f of a.followUps; track f) {
                    <button type="button" [disabled]="state.asking()" (click)="run(f, a.ward.name)">{{ tx.ai.actions[f] }} →</button>
                  }
                </div>
              }
            </article>
          }
        }
      </div>

      <footer class="ai__foot">
        <div class="ai__actions">
          @for (action of actions; track action; let first = $first) {
            <button type="button" [class.is-primary]="first" [disabled]="state.asking() || !wardName()" (click)="run(action)">{{ tx.ai.actions[action] }}</button>
          }
        </div>
        <form class="ai__input" (submit)="$event.preventDefault(); send()">
          <input
            #input
            type="text"
            maxlength="500"
            [placeholder]="tx.ai.inputPlaceholder"
            [attr.aria-label]="tx.ai.inputAria"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          />
          <button type="submit" [attr.aria-label]="tx.ai.send" [disabled]="!draft().trim() || state.asking()">↑</button>
        </form>
      </footer>
    </section>
  `,
})
export class PiAiPanelComponent {
  protected readonly state = inject(PiStateService);
  readonly wardName = input('');

  @ViewChild('log', { static: true }) private log!: ElementRef<HTMLDivElement>;
  @ViewChild('input', { static: true }) private inputEl!: ElementRef<HTMLInputElement>;

  protected readonly actions = ACTIONS;
  protected readonly draft = signal('');
  protected readonly isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  /** Whether the last answer came from Claude (the server falls back to template answers without a key). */
  protected readonly usesClaude = computed(() => [...this.state.chat()].reverse().find((t) => t.answer)?.answer?.provider === 'anthropic');

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

  protected run(intent: AskIntent, ward = this.wardName()): void {
    const q = this.state.t().ai.questions;
    const question = intent === 'project' ? q.project(this.state.project()) : q[intent](ward);
    this.state.ask(question, intent);
  }

  protected send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.state.ask(text);
    this.draft.set('');
  }
}
