import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { SiteLangService } from '../services/site-lang.service';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { PiApiService } from '../property-intel/pi.service';
import { DATA_DATE, DIRECTIONS, SOURCES, Background } from './career.data';
import { TravelItems, WardPoint, commuteText, placementsFor } from './career.geo';
import { CareerLang, channelsIn, contextIn, directionsIn, initialCareerLang, localeOf, policiesIn, signalsIn, sourceKindIn, sourceTitleIn } from './career.local';
import { CAREER_TEXT } from './career.ui';
import { CareerSwitchComponent } from './career-switch.component';
import { JobMapSectionComponent } from './job-map-section.component';
import { CareerStore, MAX_PLANS } from './career.store';
import { ReportIssueComponent } from '../components/report-issue/report-issue.component';
import { OpBrandComponent } from '../opportunity/op-brand.component';
import { OP_TEXT } from '../opportunity/op-i18n';
import { planPrintHtml } from './career.print';
import { afterThirtyDays, buildPlan, dayOf, phasesIn } from './career.plan';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { labelsIn } from './career.labels';
import { BACKGROUND_LABEL, EMPTY_PROFILE, Profile, WEIGHTS, backgroundLabel, isComplete, rankDirections } from './career.logic';

const SHOWN = 5;

type TabId = 'paths' | 'plan' | 'switch' | 'market' | 'map' | 'support';
const TABS: { id: TabId }[] = [{ id: 'paths' }, { id: 'plan' }, { id: 'switch' }, { id: 'market' }, { id: 'map' }, { id: 'support' }];

/** The tab in the address (?tab=map), so a link can open the page on it. */
function initialTab(): TabId {
  try {
    const t = new URLSearchParams(location.search).get('tab');
    return TABS.some((x) => x.id === t) ? (t as TabId) : 'paths';
  } catch {
    return 'paths';
  }
}

/**
 * La bàn nghề nghiệp Hà Nội — five short questions, then the career directions that fit, each with what the sources
 * say about Hà Nội, the skills and first steps. Not a job board: it points to the official job channels and to the
 * support the Employment Law gives. The ranking is rule-based and explained (career.logic.ts); every figure is cited.
 */
@Component({
  selector: 'app-career',
  standalone: true,
  imports: [RouterLink, JobMapSectionComponent, OpBrandComponent, ReportIssueComponent, CareerSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="cc" [attr.lang]="lang()">
      <header class="cc__hero">
        <div class="cc__herotop">
          <p class="cc__eyebrow">{{ tx().eyebrow }}</p>
          <div class="cc__lang" role="group" [attr.aria-label]="tx().language">
            <button type="button" lang="vi" [attr.aria-pressed]="lang() === 'vi'" (click)="setLang('vi')">Tiếng Việt</button>
            <button type="button" lang="en" [attr.aria-pressed]="lang() === 'en'" (click)="setLang('en')">English</button>
          </div>
        </div>
        <h1>{{ tx().title }}</h1>
        <p class="cc__lead">{{ tx().lead }}</p>
      </header>

      <nav class="cc__tabs" role="tablist" [attr.aria-label]="tx().tabsLabel">
        @for (tb of tabs; track tb.id) {
          <button
            type="button"
            role="tab"
            [id]="'cc-tab-' + tb.id"
            [attr.aria-selected]="tab() === tb.id"
            [attr.aria-controls]="'cc-panel-' + tb.id"
            [attr.tabindex]="tab() === tb.id ? 0 : -1"
            (click)="openTab(tb.id)"
            (keydown)="onTabKey($event)"
          >
            {{ tx().tabs[tb.id] }}
            @if (tb.id === 'plan' && planView(); as pv) {
              <span class="cc__tabbadge">{{ pv.done }}/{{ pv.total }}</span>
            }
          </button>
        }
      </nav>


      <!-- Your directions: the questions, then what fits -->
      @if (tab() === 'paths') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-paths" aria-labelledby="cc-tab-paths" tabindex="0">
          <section class="cc__form" aria-labelledby="cc-form">
            <h2 id="cc-form">{{ tx().aboutYou }}</h2>

            <fieldset>
              <legend>{{ tx().q1 }}</legend>
              <div class="cc__chips">
                @for (o of labels().situations; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().situation === o.value" (click)="set('situation', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>{{ tx().q2 }} <small>{{ tx().q2Hint }}</small></legend>
              <div class="cc__chips">
                @for (b of backgrounds(); track b.value) {
                  <button type="button" [attr.aria-pressed]="profile().backgrounds.includes(b.value)" (click)="toggleBackground(b.value)">{{ b.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>{{ tx().q3 }}</legend>
              <div class="cc__chips">
                @for (o of labels().educations; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().education === o.value" (click)="set('education', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>{{ tx().q4 }}</legend>
              <div class="cc__chips">
                @for (o of labels().times; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().time === o.value" (click)="set('time', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>{{ tx().q5 }}</legend>
              <div class="cc__chips">
                @for (o of labels().works; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().work === o.value" (click)="set('work', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>{{ tx().q6 }} <small>{{ tx().q6Hint }}</small></legend>
              <select class="cc__select" [attr.aria-label]="tx().wardAria" [value]="profile().ward ?? ''" (change)="setWard($any($event.target).value)">
                <option value="">{{ tx().notChosen }}</option>
                @for (w of wards(); track w.slug) {
                  <option [value]="w.slug" [selected]="w.slug === profile().ward">{{ w.name }}</option>
                }
              </select>
            </fieldset>

            <div class="cc__formfoot">
              @if (complete()) {
                <button type="button" class="cc__go" (click)="goToResults()">{{ tx().seeResults }}</button>
              } @else {
                <span class="cc__hint">{{ tx().answerAll }}</span>
              }
              <button type="button" class="cc__link" (click)="reset()">{{ tx().redo }}</button>
            </div>
          </section>

          @if (complete()) {
            <section class="cc__results" id="cc-results" aria-labelledby="cc-results-title" tabindex="-1">
              <h2 id="cc-results-title">{{ tx().resultsTitle }}</h2>
              <p class="cc__note">
                {{ tx().resultsNote }}
                @if (profile().situation === 'employed') {
                  {{ tx().employedNote }}
                }
                <button type="button" class="cc__link" (click)="goToMap()">{{ tx().seeMap }}</button>
              </p>
              <p class="cc__note"><button type="button" class="cc__link" (click)="openSwitch('')">{{ tx().calcLink }}</button></p>
              <ol class="cc__list">
                @for (r of shown(); track r.direction.id; let i = $index) {
                  <li class="cc__card" [class.is-low]="r.level === 'low'">
                    <div class="cc__cardhead">
                      <span class="cc__icon" aria-hidden="true">{{ r.direction.icon }}</span>
                      <div>
                        <h3>{{ r.direction.name }}</h3>
                        <p>{{ r.direction.blurb }}</p>
                      </div>
                      <span class="cc__badge" [attr.data-level]="r.level">{{ tx().levels[r.level] }} · {{ r.score }}</span>
                    </div>

                    @if (r.reasons.length || r.cautions.length) {
                      <ul class="cc__why">
                        @for (t of r.reasons; track t) {
                          <li class="is-good">{{ t }}</li>
                        }
                        @for (t of r.cautions; track t) {
                          <li class="is-warn">{{ t }}</li>
                        }
                      </ul>
                    }

                    <details [open]="i === 0">
                      <summary>{{ tx().details }}</summary>
                      <h4>{{ tx().hanoi }}</h4>
                      <ul class="cc__facts">
                        @for (f of r.direction.facts; track f.text) {
                          <li>{{ f.text }} @for (s of cites(f.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</li>
                        }
                      </ul>
                      <div class="cc__two">
                        <div>
                          <h4>{{ tx().roles }}</h4>
                          <ul>
                            @for (x of r.direction.roles; track x) {
                              <li>{{ x }}</li>
                            }
                          </ul>
                        </div>
                        <div>
                          <h4>{{ tx().skills }}</h4>
                          <ul>
                            @for (x of r.direction.skills; track x) {
                              <li>{{ x }}</li>
                            }
                          </ul>
                        </div>
                      </div>
                      <h4>{{ tx().route }}</h4>
                      <ol class="cc__steps">
                        @for (s of r.direction.steps; track s.when) {
                          <li><b>{{ s.when }}</b> {{ s.text }}</li>
                        }
                      </ol>
                      @if (placementsOf(r.direction.id); as places) {
                        @if (places.length) {
                          <h4>{{ tx().placesTitle }}</h4>
                          <ul class="cc__places">
                            @for (pl of places; track pl.area.id) {
                              <li>
                                <div class="cc__areahead">
                                  <b>{{ pl.area.name }}</b>
                                  <span class="cc__tag" [attr.data-kind]="pl.area.kind">{{ pl.area.kind === 'plan' ? tx().planTag : tx().landmarkTag }}</span>
                                </div>
                                <p>{{ pl.area.note }} @for (s of cites(pl.area.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</p>
                                @if (pl.commute) {
                                  <p class="cc__commute">{{ tx().from(wardName(), commuteText(pl.commute, lang())) }}</p>
                                }
                                @if (pl.near.length) {
                                  <p class="cc__near">
                                    {{ tx().nearestWards }}
                                    @for (n of pl.near; track n.ward.slug; let last = $last) {
                                      <a [routerLink]="'/property-intelligence/map'" [queryParams]="{ ward: n.ward.slug }">{{ n.ward.name }}</a> ({{ km(n.km) }} {{ tx().nearKm }}){{ last ? '' : ', ' }}
                                    }
                                  </p>
                                }
                              </li>
                            }
                          </ul>
                          <p class="cc__note">
                            @if (!profile().ward) {
                              {{ tx().chooseWard }}
                            }
                            {{ tx().placesNote }}
                          </p>
                        }
                      }
                      <p class="cc__tools">
                        @for (t of r.direction.tools; track t.path) {
                          <a [routerLink]="t.path">{{ t.label }} →</a>
                        }
                      </p>
                    </details>
                    <div class="cc__cta">
                      <button type="button" class="cc__planbtn" [class.is-on]="hasPlan(r.direction.id)" (click)="choosePlan(r.direction.id)">{{ planLabel(r.direction.id) }}</button>
                      <button type="button" class="cc__planbtn cc__calcbtn" (click)="openSwitch(r.direction.name)">{{ tx().calcCost }}</button>
                    </div>
                  </li>
                }
              </ol>
              @if (ranked().length > shownCount) {
                <button type="button" class="cc__more" (click)="showAll.set(!showAll())">{{ showAll() ? tx().fewer(shownCount) : tx().more(ranked().length - shownCount) }}</button>
              }
              <details class="cc__how">
                <summary>{{ tx().howTitle }}</summary>
                <p>{{ tx().how(weights) }}</p>
              </details>
            </section>
          }
        </div>
      }

      <!-- The 30-day plan -->
      @if (tab() === 'plan') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-plan" aria-labelledby="cc-tab-plan" tabindex="0">
          @if (planMessage(); as msg) {
            <p class="cc__planmsg" role="status">{{ msg }}</p>
          }
          @if (planChips().length > 1 || (planChips().length === 1 && !locked())) {
            <div class="cc__plans" role="group" [attr.aria-label]="tx().plansLabel">
              @for (c of planChips(); track c.id) {
                <button type="button" class="cc__planchip" [class.is-on]="c.id === plan()?.directionId" [attr.aria-pressed]="c.id === plan()?.directionId" (click)="selectPlan(c.id)">
                  {{ c.icon }} {{ c.name }} <small>{{ c.done }}/{{ c.total }}</small>
                </button>
              }
            </div>
          }
          @if (syncNote(); as note) {
            <p class="cc__sync" role="status">{{ note }}</p>
          } @else if (locked()) {
            <button type="button" class="cc__premiumnote" (click)="askPremium(tx().askSave)">
              <span aria-hidden="true">★</span> {{ tx().premiumPlans(maxPlans) }}
            </button>
          }
          @if (planView(); as pv) {
            <section class="cc__plan" id="cc-plan" tabindex="-1" aria-labelledby="cc-plan-title">
              <div class="cc__planhead">
                <div>
                  <h2 id="cc-plan-title">{{ tx().planHead(pv.direction.name) }}</h2>
                  <p>{{ tx().planSub(pv.started, pv.dayText) }}</p>
                </div>
                <div class="cc__progress">
                  <b>{{ tx().tasks(pv.done, pv.total) }}</b>
                  <progress [value]="pv.done" [max]="pv.total" [attr.aria-label]="tx().progressAria"></progress>
                </div>
              </div>
              @for (ph of pv.phases; track ph.id) {
                <h3>{{ ph.title }}</h3>
                <p class="cc__phasehint">{{ ph.hint }}</p>
                <ul class="cc__tasks">
                  @for (it of ph.items; track it.id) {
                    <li>
                      <label>
                        <input type="checkbox" [checked]="pv.doneIds.has(it.id)" (change)="toggleItem(it.id)" />
                        <span>
                          {{ it.text }}
                          @for (l of it.links ?? []; track l.label) {
                            @if (l.path) {
                              <a [routerLink]="l.path">{{ l.label }} →</a>
                            } @else {
                              <a [href]="l.href" target="_blank" rel="noopener noreferrer">{{ l.label }} ↗</a>
                            }
                          }
                          @for (s of cites(it.sources ?? []); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }
                        </span>
                      </label>
                    </li>
                  }
                </ul>
              }
              <p class="cc__after"><b>{{ tx().after }}</b> {{ pv.after }}</p>
          <div class="cc__export">
            <button type="button" class="cc__go" (click)="exportPdf()">
              <span aria-hidden="true">⬇</span> {{ tx().exportPdf }} @if (locked()) { <span class="cc__star" aria-hidden="true">★</span> }
            </button>
            <span class="cc__hint">{{ tx().exportHint }}</span>
            @if (exportMessage(); as em) {
              <span class="cc__hint" role="status">{{ em }}</span>
            }
          </div>
          <app-op-brand [t]="brandText()" [lang]="lang()" [teaser]="tx().brandTeaser" [hint]="tx().brandHint" />
              <p class="cc__note">{{ tx().keepNote }}</p>
              <button type="button" class="cc__link" (click)="clearPlan()">{{ tx().clear }}</button>
            </section>
          } @else {
      <section class="cc__plan cc__plan--empty" id="cc-plan" aria-labelledby="cc-plan-title">
        <h2 id="cc-plan-title">{{ tx().emptyTitle }}</h2>
        <p>{{ tx().emptyText }}</p>
        <button type="button" class="cc__go" (click)="openTab('paths')">{{ tx().emptyButton }}</button>
      </section>
          }
        </div>
      }

      <!-- The career-change calculator -->
      @if (tab() === 'switch') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-switch" aria-labelledby="cc-tab-switch" tabindex="0">
          <app-career-switch [lang]="lang()" [suggestedName]="switchName()" />
        </div>
      }

      <!-- The market -->
      @if (tab() === 'market') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-market" aria-labelledby="cc-tab-market" tabindex="0">
          <section class="cc__context" aria-labelledby="cc-context">
            <h2 id="cc-context">{{ tx().contextTitle }}</h2>
            <div class="cc__stats">
              @for (c of context(); track c.label) {
                <div class="cc__stat">
                  <b>{{ c.value }}</b>
                  <span>{{ c.label }} @for (s of cites(c.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</span>
                </div>
              }
            </div>
            <p class="cc__note">{{ tx().contextNote }}</p>

            <h3 class="cc__subhead">{{ tx().marketTitle }}</h3>
            <p class="cc__note">{{ tx().marketNote }}</p>
            <div class="cc__scroll">
              <table class="cc__market">
                <thead>
                  <tr>
                    <th scope="col">{{ tx().colField }}</th>
                    <th scope="col">{{ tx().colSignal }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of market(); track m.direction.id) {
                    <tr [class.is-yours]="m.yours">
                      <th scope="row">{{ m.direction.icon }} {{ m.direction.name }} @if (m.yours) { <span class="cc__yours">{{ tx().yours }}</span> }</th>
                      <td>{{ m.signal.text }} @for (s of cites(m.signal.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      }

      <!-- The map: kept once opened, so the sector, home and zone you chose stay when you switch tabs -->
      <div class="cc__panel" role="tabpanel" id="cc-panel-map" aria-labelledby="cc-tab-map" tabindex="0" [hidden]="tab() !== 'map'">
        @if (mapSeen()) {
          @defer {
            <app-job-map-section [home]="profile().ward" [lang]="lang()" (homeChange)="setWard($event)" />
          } @placeholder {
            <div class="cc__mapph">{{ tx().mapLoading }}</div>
          }
        }
      </div>

      <!-- Support and where to look for work -->
      @if (tab() === 'support') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-support" aria-labelledby="cc-tab-support" tabindex="0">
          <section class="cc__support" aria-labelledby="cc-support">
            <h2 id="cc-support">{{ tx().supportTitle }}</h2>
            <div class="cc__grid">
              <div>
                <h3>{{ tx().policiesTitle }}</h3>
                <dl class="cc__policies">
                  @for (p of policies(); track p.title) {
                    <dt>{{ p.title }}</dt>
                    <dd>{{ p.text }} @for (s of cites(p.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</dd>
                  }
                </dl>
                <p class="cc__note">{{ tx().policiesNote }}</p>
              </div>
              <div>
                <h3>{{ tx().findTitle }}</h3>
                <ul class="cc__channels">
                  @for (c of channels(); track c.url) {
                    <li>
                      <a [href]="c.url" target="_blank" rel="noopener noreferrer">{{ c.name }} ↗</a>
                      <span>{{ c.text }} @for (s of cites(c.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</span>
                    </li>
                  }
                </ul>
                <p class="cc__note">{{ tx().findNote }}</p>
              </div>
            </div>
          </section>
        </div>
      }

      <details class="cc__sources">
        <summary><h2 id="cc-sources">{{ tx().sourcesTitle }} ({{ sources.length }})</h2></summary>
        <ol>
          @for (s of sources; track s.id) {
            <li>
              <a [href]="s.url" target="_blank" rel="noopener noreferrer" [attr.lang]="s.kind === 'computed' ? lang() : 'vi'">{{ sourceTitle(s) }}</a> — {{ s.publisher }}
              <small>({{ sourceKind(s.kind) }})</small>
              <app-report-issue kind="source" [target]="s.id" [targetName]="s.title" page="career" [lang]="lang()" [compact]="true" />
            </li>
          }
        </ol>
        <p class="cc__note">{{ tx().sourcesNote(dataDate) }} {{ tx().sourcesLang }}</p>
      </details>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .cc { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; display: grid; gap: 28px; }
    .cc__hero h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 560; font-size: clamp(28px, 5vw, 44px); line-height: 1.12; margin: 4px 0 10px; }
    .cc__herotop { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
    .cc__lang { display: inline-flex; gap: 4px; padding: 3px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface-2); }
    .cc__lang button { padding: 6px 14px; min-height: 34px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .cc__lang button[aria-pressed='true'] { background: var(--app-career); color: #fff; }
    .cc__eyebrow { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--app-career); }
    .cc__lead { margin: 0; max-width: 720px; color: var(--app-ink-dim); font-size: 16px; }
    h2 { margin: 0 0 10px; font-size: 20px; }
    h3 { margin: 0; font-size: 17px; }
    h4 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--app-ink-dim); }
    .cc__note { margin: 8px 0 0; font-size: 12.5px; color: var(--app-ink-dim); }
    .cc__cite { font-size: 11px; font-weight: 700; color: var(--app-career); text-decoration: none; margin-left: 2px; }
    .cc__cite:hover { text-decoration: underline; }
    .cc__stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .cc__stat { padding: 12px 14px; border: 1px solid var(--app-line); border-radius: 12px; background: var(--app-surface); display: grid; gap: 2px; }
    .cc__stat b { font-size: 24px; color: var(--app-career); }
    .cc__stat span { font-size: 13px; color: var(--app-ink-dim); }
    .cc__form { padding: 20px; border: 1px solid var(--app-line); border-radius: 16px; background: var(--app-surface); display: grid; gap: 18px; }
    fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    legend { padding: 0; margin-bottom: 8px; font-weight: 700; font-size: 15px; }
    legend small { font-weight: 500; color: var(--app-ink-dim); margin-left: 6px; }
    .cc__chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .cc__chips button { padding: 8px 14px; min-height: 40px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface-2); color: inherit; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .cc__chips button[aria-pressed='true'] { border-color: var(--app-career); background: var(--app-career-soft); color: var(--app-career); }
    .cc button:focus-visible, .cc a:focus-visible, .cc summary:focus-visible { outline: 2px solid var(--app-career); outline-offset: 2px; }
    .cc__formfoot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
    .cc__hint { font-size: 13px; color: var(--app-ink-dim); }
    .cc__go { padding: 10px 18px; min-height: 44px; border: 0; border-radius: 999px; background: var(--app-career); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .cc__link { border: 0; background: none; color: var(--app-career); font: inherit; font-weight: 700; cursor: pointer; padding: 4px 0; }
    .cc__results { scroll-margin-top: 130px; outline: none; }
    .cc__list { list-style: none; margin: 14px 0; padding: 0; display: grid; gap: 14px; }
    .cc__card { padding: 16px 18px; border: 1px solid var(--app-line); border-left: 4px solid var(--app-career); border-radius: 14px; background: var(--app-surface); }
    .cc__card.is-low { opacity: 0.8; border-left-color: var(--app-line); }
    .cc__cardhead { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: start; }
    .cc__cardhead p { margin: 2px 0 0; font-size: 13.5px; color: var(--app-ink-dim); }
    .cc__icon { font-size: 30px; line-height: 1; }
    .cc__badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; background: var(--app-surface-2); }
    .cc__badge[data-level='high'] { background: var(--app-career-soft); color: var(--app-career); }
    .cc__badge[data-level='medium'] { background: var(--app-time-soft); color: var(--app-time); }
    .cc__why { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 3px; font-size: 13.5px; }
    .cc__why li::before { content: '✓ '; color: var(--app-career); font-weight: 700; }
    .cc__why li.is-warn::before { content: '! '; color: var(--app-time); }
    details { margin-top: 10px; }
    summary { cursor: pointer; font-weight: 700; font-size: 14px; color: var(--app-career); }
    .cc__facts { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; }
    .cc__two { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0 20px; }
    .cc__two ul { margin: 0; padding-left: 18px; font-size: 14px; }
    .cc__steps { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; }
    .cc__steps b { color: var(--app-career); margin-right: 4px; }
    .cc__tools { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 12px 0 0; }
    .cc__tools a, .cc__channels a { color: var(--app-career); font-weight: 700; }
    .cc__more { padding: 9px 16px; min-height: 40px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface); color: inherit; font: inherit; font-weight: 700; cursor: pointer; }
    .cc__how { margin-top: 12px; }
    .cc__how p { margin: 6px 0 0; font-size: 13.5px; color: var(--app-ink-dim); }
    .cc__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .cc__policies { margin: 8px 0 0; display: grid; gap: 2px; }
    .cc__policies dt { font-weight: 700; margin-top: 10px; font-size: 14px; }
    .cc__policies dd { margin: 0; font-size: 14px; color: var(--app-ink-dim); }
    .cc__channels { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 12px; }
    .cc__channels li { display: grid; gap: 2px; }
    .cc__channels span { font-size: 14px; color: var(--app-ink-dim); }
    .cc__sources ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 13.5px; }
    .cc__sources a { color: var(--app-career); }
    .cc__sources small { color: var(--app-ink-faint); }
    .cc__subhead { margin: 20px 0 0; font-size: 17px; }
    .cc__scroll { overflow-x: auto; margin-top: 8px; }
    .cc__market { width: 100%; border-collapse: collapse; font-size: 14px; }
    .cc__market th, .cc__market td { padding: 8px 10px; border-bottom: 1px solid var(--app-line); text-align: left; vertical-align: top; }
    .cc__market thead th { font-size: 12.5px; color: var(--app-ink-dim); }
    .cc__market tbody th { font-weight: 700; width: 36%; }
    .cc__market tr.is-yours { background: var(--app-career-soft); }
    .cc__yours { margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: var(--app-career); color: #fff; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
    .cc__tabs { display: flex; gap: 6px; overflow-x: auto; position: sticky; top: var(--site-nav-h, 56px); z-index: 5; padding: 8px 0; background: var(--app-bg); border-bottom: 1px solid var(--app-line); scrollbar-width: none; }
    .cc__tabs::-webkit-scrollbar { display: none; }
    .cc__tabs button { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; min-height: 42px; border: 1px solid transparent; border-radius: 999px; background: transparent; color: var(--app-ink-dim); font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .cc__tabs button:hover { background: var(--app-surface-2); color: var(--app-ink); }
    .cc__tabs button[aria-selected='true'] { border-color: var(--app-career); background: var(--app-career-soft); color: var(--app-career); }
    .cc__tabbadge { padding: 0 8px; border-radius: 999px; background: var(--app-career); color: #fff; font-size: 12px; }
    .cc__panel { display: grid; gap: 28px; outline: none; }
    .cc__panel[hidden] { display: none; }
    .cc__plans { display: flex; flex-wrap: wrap; gap: 8px; }
    .cc__planchip { padding: 8px 14px; min-height: 40px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface-2); color: inherit; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .cc__planchip small { margin-left: 4px; color: var(--app-ink-dim); }
    .cc__planchip.is-on { border-color: var(--app-career); background: var(--app-career-soft); color: var(--app-career); }
    .cc__planmsg { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--app-time-soft); font-size: 13.5px; }
    .cc__sync { margin: 0; font-size: 13px; color: var(--app-ink-dim); }
    .cc__premiumnote { width: 100%; padding: 10px 14px; border: 1px dashed color-mix(in srgb, #d97706 55%, transparent); border-radius: 12px; background: color-mix(in srgb, #d97706 8%, transparent); color: inherit; font: inherit; font-size: 13.5px; font-weight: 700; text-align: left; cursor: pointer; }
    .cc__premiumnote span { color: #d97706; }
    .cc__export { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 14px; }
    .cc__star { color: #fcd34d; }
    .cc__plan--empty { display: grid; gap: 10px; justify-items: start; padding: 20px; border: 1px dashed var(--app-career); border-radius: 16px; }
    .cc__plan--empty p { margin: 0; max-width: 620px; color: var(--app-ink-dim); }
    .cc__mapph { min-height: 640px; display: grid; place-items: center; border: 1px dashed var(--app-line); border-radius: 14px; color: var(--app-ink-dim); font-size: 14px; }
    .cc__select { width: 100%; max-width: 360px; min-height: 42px; padding: 8px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); color: inherit; font: inherit; }
    .cc__plan { scroll-margin-top: 130px; outline: none; padding: 20px; border: 2px solid var(--app-career); border-radius: 16px; background: linear-gradient(var(--app-career-soft), var(--app-surface) 40%); }
    .cc__planhead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px 20px; }
    .cc__planhead p { margin: 2px 0 0; font-size: 13px; color: var(--app-ink-dim); }
    .cc__progress { display: grid; gap: 4px; min-width: 180px; font-size: 13px; }
    progress { width: 100%; height: 10px; accent-color: var(--app-career); }
    .cc__plan h3 { margin: 16px 0 0; font-size: 15px; }
    .cc__phasehint { margin: 0 0 6px; font-size: 12.5px; color: var(--app-ink-dim); }
    .cc__tasks { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .cc__tasks label { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface); cursor: pointer; font-size: 14px; }
    .cc__tasks input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--app-career); flex-shrink: 0; }
    .cc__tasks input:checked + span { color: var(--app-ink-dim); text-decoration: line-through; }
    .cc__tasks a { color: var(--app-career); font-weight: 700; margin-left: 6px; }
    .cc__after { margin: 14px 0 6px; font-size: 14px; }
    .cc__sources summary { cursor: pointer; }
    .cc__sources summary h2 { display: inline; }
    .cc__sources ol { margin-top: 12px; }
    .cc__cta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .cc__cta .cc__planbtn { margin-top: 0; }
    .cc__calcbtn { border-color: var(--app-line); background: var(--app-surface); color: var(--app-ink); }
    .cc__planbtn { margin-top: 12px; padding: 9px 16px; min-height: 40px; border: 1px solid var(--app-career); border-radius: 999px; background: var(--app-career-soft); color: var(--app-career); font: inherit; font-weight: 700; cursor: pointer; }
    .cc__planbtn.is-on { background: var(--app-career); color: #fff; }
    .cc__places { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .cc__places li { padding: 10px 12px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface-2); }
    .cc__places p { margin: 3px 0 0; font-size: 13.5px; color: var(--app-ink-dim); }
    .cc__areahead { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
    .cc__tag { padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: var(--app-surface); border: 1px solid var(--app-line); color: var(--app-ink-dim); }
    .cc__tag[data-kind='plan'] { color: var(--app-time); border-color: var(--app-time); }
    .cc__places .cc__commute { color: var(--app-ink); font-weight: 600; }
    .cc__near a { color: var(--app-career); font-weight: 700; }
    /* The tabs scroll sideways on a phone: no scrollbar, and the fade at the right edge says there are more. */
    @media (max-width: 700px) { .cc__tabs { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); padding-right: 24px; } .cc__herotop { margin-bottom: 8px; } }
    @media (max-width: 560px) { .cc__cardhead { grid-template-columns: auto 1fr; } .cc__badge { grid-column: 1 / -1; justify-self: start; } }
  `,
})
export class CareerComponent {
  /** The language of the page: in the address (?lang=en), else the one remembered, else Vietnamese. */
  protected readonly lang = signal<CareerLang>(initialCareerLang());
  private readonly site = inject(SiteLangService);
  private readonly followSiteLang = effect(() => {
    const next = this.site.lang();
    untracked(() => {
      if (next !== this.lang()) this.applyLang(next);
    });
  });
  protected readonly tx = computed(() => CAREER_TEXT[this.lang()]);
  protected readonly labels = computed(() => labelsIn(this.lang()));
  private readonly directions = computed(() => directionsIn(this.lang()));
  protected readonly context = computed(() => contextIn(this.lang()));
  protected readonly policies = computed(() => policiesIn(this.lang()));
  protected readonly channels = computed(() => channelsIn(this.lang()));
  private readonly signals = computed(() => signalsIn(this.lang()));
  protected readonly sources = SOURCES;
  protected readonly dataDate = DATA_DATE;
  protected readonly weights = WEIGHTS;
  protected readonly shownCount = SHOWN;
  protected readonly backgrounds = computed(() => (Object.keys(BACKGROUND_LABEL) as Background[]).map((value) => ({ value, label: backgroundLabel(value, this.lang()) })));

  private readonly api = inject(PiApiService);
  protected readonly tabs = TABS;
  protected readonly tab = signal<TabId>(initialTab());
  /** The direction the person came from to the calculator: it names the first option there. */
  protected readonly switchName = signal('');
  /** The map is created when its tab is first opened and then kept, so what you chose on it stays. */
  protected readonly mapSeen = signal(initialTab() === 'map');
  private readonly store = inject(CareerStore);
  private readonly title = inject(Title);
  private readonly billing = inject(BillingService);
  private readonly premiumPrompt = inject(PremiumPromptService);
  /** The answers and the 30-day plans: kept in this browser, and in the account with Premium (career.store.ts). */
  protected readonly profile = this.store.profile;
  protected readonly plan = this.store.active;
  protected readonly locked = this.billing.premiumLocked;
  protected readonly planMessage = signal<string | null>(null);

  /** The 79 wards and communes (for the "where do you live" question and the distances); empty if the server is unreachable. */
  protected readonly wards = toSignal(
    this.api.wards().pipe(
      map((r) => r.wards.map((w): WardPoint => ({ slug: w.slug, name: w.name, center: w.center as [number, number] })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))),
      catchError(() => of([] as WardPoint[])),
    ),
    { initialValue: [] as WardPoint[] },
  );
  private readonly currentWard = computed(() => this.wards().find((w) => w.slug === this.profile().ward) ?? null);
  protected readonly wardName = computed(() => this.currentWard()?.name ?? '');
  /** Driving times from the chosen ward to the reference places (null: none chosen, or not available). */
  private readonly travel = toSignal(
    toObservable(computed(() => this.profile().ward)).pipe(
      switchMap((slug) => (slug ? this.api.ward(slug, 'vi').pipe(map((d) => d.travel as TravelItems | null), catchError(() => of(null))) : of(null))),
    ),
    { initialValue: null as TravelItems | null },
  );
  private readonly placements = computed(() => new Map(DIRECTIONS.map((d) => [d.id, placementsFor(d.id, this.currentWard(), this.wards(), this.travel(), this.lang())])));

  protected readonly planView = computed(() => {
    const plan = this.plan();
    const direction = plan ? this.directions().find((d) => d.id === plan.directionId) : null;
    if (!plan || !direction) return null;
    const lang = this.lang();
    const tx = this.tx();
    const items = buildPlan(this.profile(), direction, lang);
    const doneIds = new Set(plan.done);
    const day = dayOf(plan);
    return {
      direction,
      started: new Date(plan.startedAt).toLocaleDateString(localeOf(lang)),
      dayText: day ? tx.dayOf(day) : tx.over30,
      done: items.filter((i) => doneIds.has(i.id)).length,
      total: items.length,
      doneIds,
      phases: phasesIn(lang).map((p) => ({ ...p, items: items.filter((i) => i.phase === p.id) })),
      after: afterThirtyDays(direction),
    };
  });
  /** One chip per plan kept, with its progress. */
  protected readonly planChips = computed(() =>
    this.store.plans().map((p) => {
      const direction = this.directions().find((d) => d.id === p.directionId)!;
      const items = buildPlan(this.profile(), direction, this.lang());
      return { id: p.directionId, name: direction.name, icon: direction.icon, done: items.filter((i) => p.done.includes(i.id)).length, total: items.length };
    }),
  );
  /** What the account is doing with the plans, for people whose plans are kept there. */
  protected readonly syncNote = computed(() => {
    if (!this.store.inAccount()) return null;
    if (this.store.syncing()) return this.tx().syncing;
    return this.store.syncError() ?? this.tx().saved;
  });
  protected readonly maxPlans = MAX_PLANS;
  protected readonly brandText = computed(() => OP_TEXT[this.lang()].premium);
  protected readonly exportMessage = signal<string | null>(null);
  protected readonly showAll = signal(false);
  protected readonly complete = computed(() => isComplete(this.profile()));
  /** One market signal per direction, with those close to the visitor's own field marked. */
  protected readonly market = computed(() =>
    this.directions().map((direction) => ({ direction, signal: this.signals()[direction.id], yours: this.profile().backgrounds.some((b) => direction.fit[b] === 3) })),
  );
  protected readonly ranked = computed(() => rankDirections(this.profile(), this.directions(), this.lang()));
  protected readonly shown = computed(() => (this.showAll() ? this.ranked() : this.ranked().slice(0, SHOWN)));

  /** The sources of a figure, with their number in the list at the end of the page. */
  protected cites(ids: string[]): { id: string; n: number; url: string; title: string }[] {
    return ids.map((id) => {
      const i = SOURCES.findIndex((s) => s.id === id);
      return { id, n: i + 1, url: SOURCES[i]?.url ?? '', title: SOURCES[i] ? sourceTitleIn(SOURCES[i], this.lang()) : '' };
    });
  }

  protected sourceTitle(s: (typeof SOURCES)[number]): string {
    return sourceTitleIn(s, this.lang());
  }

  protected sourceKind(kind: (typeof SOURCES)[number]['kind']): string {
    return sourceKindIn(kind, this.lang());
  }

  protected set<K extends 'situation' | 'education' | 'time' | 'work'>(key: K, value: Profile[K]): void {
    this.profile.update((p) => ({ ...p, [key]: value }));
  }

  protected setWard(slug: string): void {
    this.profile.update((p) => ({ ...p, ward: slug || null }));
  }

  protected placementsOf(directionId: string) {
    return this.placements().get(directionId) ?? [];
  }

  protected readonly commuteText = commuteText;

  protected km(n: number): string {
    return n.toLocaleString(localeOf(this.lang()), { maximumFractionDigits: 1 });
  }

  /** Switches the page between Vietnamese and English, and remembers it (in the address and in this browser). */
  protected setLang(lang: CareerLang): void {
    this.site.set(lang);
  }

  /** The site's language changed (here or in the top bar): the page, its title and its address follow. */
  private applyLang(lang: CareerLang): void {
    this.lang.set(lang);
    this.title.setTitle(CAREER_TEXT[lang].docTitle);
    try {
      const url = new URL(location.href);
      if (lang === 'en') url.searchParams.set('lang', 'en');
      else url.searchParams.delete('lang');
      history.replaceState(history.state, '', url.pathname + url.search);
    } catch {
      /* no history (tests) */
    }
  }

  /** Starts the 30-day plan of a direction and shows it. Without Premium one plan is kept: another needs Premium. */
  protected choosePlan(directionId: string): void {
    this.planMessage.set(null);
    const result = this.store.start(directionId);
    if (result === 'limit') {
      if (this.locked()) this.askPremium(this.tx().askMany);
      else {
        this.planMessage.set(this.tx().planLimit(MAX_PLANS));
        this.openTab('plan');
      }
      return;
    }
    this.openTab('plan', 'cc-plan');
  }

  protected hasPlan(directionId: string): boolean {
    return this.planChips().some((c) => c.id === directionId);
  }

  protected planLabel(directionId: string): string {
    const tx = this.tx();
    if (this.hasPlan(directionId)) return tx.planOn;
    return this.locked() && this.planChips().length >= 1 ? tx.planExtra : tx.planStart;
  }

  protected selectPlan(directionId: string): void {
    this.store.select(directionId);
  }

  protected toggleItem(id: string): void {
    this.store.toggle(id);
  }

  protected clearPlan(): void {
    const active = this.plan();
    if (active) this.store.remove(active.directionId);
    this.planMessage.set(null);
  }

  /** Opens the printable plan in a new tab (Premium); a Premium account with saved details gets them on it. */
  protected exportPdf(): void {
    if (this.locked()) return this.askPremium(this.tx().askPdf);
    const view = this.planView();
    const plan = this.plan();
    if (!view || !plan) return;
    this.exportMessage.set(null);
    const direction = view.direction;
    const lang = this.lang();
    const html = planPrintHtml({
      lang,
      direction,
      items: buildPlan(this.profile(), direction, lang),
      done: view.doneIds,
      profile: this.profile(),
      ranked: this.ranked().find((r) => r.direction.id === direction.id) ?? null,
      places: this.placementsOf(direction.id).map((p) => ({
        name: p.area.name,
        kind: p.area.kind,
        note: p.area.note,
        commute: commuteText(p.commute, lang),
        near: p.near.map((n) => `${n.ward.name} (${this.km(n.km)} km)`).join(', '),
        sources: p.area.sources,
      })),
      wardName: this.wardName(),
      startedAt: plan.startedAt,
      generatedAt: new Date(),
      brand: this.billing.brand(),
    });
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const tab = window.open(url, '_blank');
    if (!tab) this.exportMessage.set(this.tx().exportBlocked);
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  /** From a direction (or the note under the results) to the career-change calculator. */
  protected openSwitch(directionName: string): void {
    this.switchName.set(directionName);
    this.openTab('switch');
  }

  protected askPremium(feature: string): void {
    this.premiumPrompt.open(feature, this.lang());
  }

  protected toggleBackground(b: Background): void {
    this.profile.update((p) => ({ ...p, backgrounds: p.backgrounds.includes(b) ? p.backgrounds.filter((x) => x !== b) : [...p.backgrounds, b] }));
  }

  protected reset(): void {
    this.profile.set({ ...EMPTY_PROFILE });
    this.showAll.set(false);
  }

  protected openTab(id: TabId, scrollTo?: string): void {
    this.tab.set(id);
    if (id === 'map') this.mapSeen.set(true);
    try {
      const url = new URL(location.href);
      if (id === 'paths') url.searchParams.delete('tab');
      else url.searchParams.set('tab', id);
      history.replaceState(history.state, '', url.pathname + url.search);
    } catch {
      /* no history (tests): the tab still changes */
    }
    // After the new tab is drawn, make sure its beginning is not left behind the sticky header and tab bar.
    setTimeout(() => {
      const bar = document.querySelector<HTMLElement>('.cc__tabs');
      const target = document.getElementById(scrollTo ?? `cc-panel-${id}`);
      if (!bar || !target) return;
      const free = bar.getBoundingClientRect().bottom + 12;
      const top = target.getBoundingClientRect().top;
      // Asked for an element: put it right under the bar. Otherwise only move when the content starts under the bar.
      if (scrollTo || top < free) window.scrollBy({ top: top - free, behavior: 'smooth' });
      if (scrollTo) target.focus({ preventScroll: true });
    }, 50);
  }

  /** Arrow keys, Home and End move between the tabs. */
  protected onTabKey(event: KeyboardEvent): void {
    const i = TABS.findIndex((t) => t.id === this.tab());
    const next = event.key === 'ArrowRight' ? (i + 1) % TABS.length : event.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.openTab(TABS[next].id, undefined);
    setTimeout(() => document.getElementById('cc-tab-' + TABS[next].id)?.focus());
  }

  protected goToMap(): void {
    this.openTab('map');
  }

  protected goToResults(): void {
    const el = document.getElementById('cc-results');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  }
}
