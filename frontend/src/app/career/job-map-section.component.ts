import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { ReportIssueComponent } from '../components/report-issue/report-issue.component';
import { OpportunityService } from '../opportunity/op.service';
import { Opportunity, WardDetail, WardsResponse } from '../opportunity/op.models';
import { MetroHorizon, MetroPoint } from '../property-intel/pi.models';
import { PiApiService } from '../property-intel/pi.service';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { ThemeService } from '../services/theme.service';
import { AREAS } from './career.data';
import { CareerLang, areasIn, localeOf } from './career.local';
import { JOBMAP_TEXT } from './career.ui';
import { LIVE_LIMITS, LiveLimit, LiveSort, Workplace, liveClasses, metroFromTextIn, rankHomes } from './career.live';
import { Metric, NO_DATA, RAMP, breaks, classOf, figureOf, legend, markers, topSectors } from './career.jobmap';
import { MetroLink, ZONES, Zone, linkTextIn, metroClass, metroHorizonsIn, metroLink, reachSummary } from './career.reach';
import { JobMapComponent, MapMode, METRO_COLORS } from './job-map.component';

const DEFAULT_TYPE = 'cafe';

/**
 * "Bản đồ ngành nghề theo khu vực": pick a service sector and see which wards have the most places of it on the map
 * (a sign of where that work is, not a count of vacancies), with the planned poles and the reference places on top;
 * click a ward to see which sectors are thickest around it. Data of the Business Opportunity Map (OpenStreetMap).
 *
 * With a home ward chosen it also answers two questions the Business Opportunity Map does not ask: which wards can be
 * reached by car within 15–45 minutes (the rest fade out), and where metro lines serve — now, from 2027 and under the plan.
 */
@Component({
  selector: 'app-job-map-section',
  standalone: true,
  imports: [RouterLink, JobMapComponent, ReportIssueComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="jm" aria-labelledby="jm-title">
      <h2 id="jm-title">{{ tx().title }}</h2>
      <p class="jm__lead">
        {{ tx().lead1 }}
        <strong>{{ tx().leadBold }}</strong>{{ tx().lead2 }}
      </p>

      <div class="jm__layers" role="group" [attr.aria-label]="tx().layersAria">
        <button type="button" [attr.aria-pressed]="layer() === 'sector'" (click)="setLayer('sector')">{{ tx().layerSector }}</button>
        <button type="button" [attr.aria-pressed]="layer() === 'metro'" (click)="setLayer('metro')">{{ tx().layerMetro }}</button>
        <button type="button" [attr.aria-pressed]="layer() === 'live'" (click)="setLayer('live')">{{ tx().layerLive }} @if (locked()) { <span class="jm__star" aria-hidden="true">★</span> }</button>
      </div>

      @if (layer() === 'sector') {
        <div class="jm__chips" role="group" [attr.aria-label]="tx().sectorAria">
          @for (t of types(); track t.key) {
            <button type="button" [attr.aria-pressed]="type() === t.key" (click)="type.set(t.key); selected.set(null)">{{ t.icon }} {{ t.name }}</button>
          }
        </div>
        <div class="jm__controls">
          <div class="jm__seg" role="group" [attr.aria-label]="tx().colourAria">
            <button type="button" [attr.aria-pressed]="metric() === 'count'" (click)="metric.set('count')">{{ tx().metricCount }}</button>
            <button type="button" [attr.aria-pressed]="metric() === 'per10k'" (click)="metric.set('per10k')">{{ tx().metricDensity }}</button>
          </div>
        </div>
      }
      <label class="jm__check"><input type="checkbox" [checked]="showMarkers()" (change)="showMarkers.set($any($event.target).checked)" /> {{ tx().markersCheck }}</label>

      <div class="jm__home" role="group" [attr.aria-label]="tx().homeAria">
        <label class="jm__homesel">
          <span>{{ tx().homeLabel }}</span>
          <select [attr.aria-label]="tx().wardAria" [value]="home() ?? ''" (change)="homeChange.emit($any($event.target).value)">
            <option value="">{{ tx().notChosen }}</option>
            @for (w of wardOptions(); track w.slug) {
              <option [value]="w.slug" [selected]="w.slug === home()">{{ w.name }}</option>
            }
          </select>
        </label>
        @if (layer() === 'sector') {
          <div class="jm__row">
            <span class="jm__label">{{ tx().driveIn }}</span>
            <div class="jm__seg" role="group" [attr.aria-label]="tx().zoneAria">
              <button type="button" [attr.aria-pressed]="zone() === null" (click)="zone.set(null)">{{ tx().all }}</button>
              @for (z of zones; track z) {
                <button type="button" [attr.aria-pressed]="zone() === z" [disabled]="!home()" [title]="home() ? tx().zoneTitleOn : tx().zoneTitleOff" (click)="zone.set(z)">{{ tx().minutes(z) }}</button>
              }
            </div>
          </div>
        }
        @if (layer() === 'metro') {
          <div class="jm__row">
            <span class="jm__label">{{ tx().metroAt }}</span>
            <div class="jm__seg" role="group" [attr.aria-label]="tx().metroAria">
              @for (h of horizons(); track h.id) {
                <button type="button" [attr.aria-pressed]="metroH() === h.id" [title]="h.hint" (click)="metroH.set(h.id)">{{ h.label }}</button>
              }
            </div>
          </div>
        }
      </div>

      @if (layer() === 'live') {
        <div class="jm__live" role="group" [attr.aria-label]="tx().liveAria">
          <p class="jm__livehint">{{ tx().liveHint }}</p>
          <div class="jm__livepick">
            <label>
              <span>{{ tx().work1 }}</span>
              <select [attr.aria-label]="tx().work1Aria" [value]="workA() ?? ''" (change)="workA.set($any($event.target).value || null)">
                <option value="">{{ tx().chooseWork }}</option>
                <optgroup [label]="tx().landmarks">
                  @for (p of placeOptions(); track p.id) {
                    <option [value]="p.id" [selected]="p.id === workA()">{{ p.name }}</option>
                  }
                </optgroup>
                <optgroup [label]="tx().wards">
                  @for (w of wardOptions(); track w.slug) {
                    <option [value]="w.slug" [selected]="w.slug === workA()">{{ w.name }}</option>
                  }
                </optgroup>
              </select>
            </label>
            <label>
              <span>{{ tx().work2 }}</span>
              <select [attr.aria-label]="tx().work2Aria" [value]="workB() ?? ''" (change)="workB.set($any($event.target).value || null)">
                <option value="">{{ tx().none }}</option>
                <optgroup [label]="tx().landmarks">
                  @for (p of placeOptions(); track p.id) {
                    <option [value]="p.id" [selected]="p.id === workB()">{{ p.name }}</option>
                  }
                </optgroup>
                <optgroup [label]="tx().wards">
                  @for (w of wardOptions(); track w.slug) {
                    <option [value]="w.slug" [selected]="w.slug === workB()">{{ w.name }}</option>
                  }
                </optgroup>
              </select>
            </label>
          </div>
          <div class="jm__row">
            <span class="jm__label">{{ tx().eachWork }}</span>
            <div class="jm__seg" role="group" [attr.aria-label]="tx().limitAria">
              @for (l of liveLimits; track l) {
                <button type="button" [attr.aria-pressed]="liveLimit() === l" (click)="liveLimit.set(l)">{{ tx().minutes(l) }}</button>
              }
            </div>
          </div>
          <div class="jm__row">
            <span class="jm__label">{{ tx().sortBy }}</span>
            <div class="jm__seg" role="group" [attr.aria-label]="tx().sortAria">
              <button type="button" [attr.aria-pressed]="liveSort() === 'time'" (click)="liveSort.set('time')">{{ tx().sortTime }}</button>
              <button type="button" [attr.aria-pressed]="liveSort() === 'price'" (click)="liveSort.set('price')">{{ tx().sortPrice }}</button>
            </div>
          </div>
        </div>
      }

      @if (layer() === 'sector' && zoneSummary(); as z) {
        <p class="jm__summary" role="status">
          @if (lang() === 'en') {
            From <b>{{ homeName() }}</b>, within <b>{{ zone() }} minutes</b> by car (free-flowing roads) you can reach <b>{{ z.wards }}/{{ z.total }}</b> wards and communes
            @if (current(); as c) {
              with <b>{{ z.places }}</b> {{ c.name.toLowerCase() }} places.
              @if (z.top.length) {
                {{ tx().zoneDensest }} @for (t of z.top; track t.slug; let last = $last) { <a href="javascript:void(0)" (click)="selected.set(t.slug)">{{ t.name }}</a> ({{ t.count }}){{ last ? '.' : ', ' }} }
              }
            } @else {
              .
            }
          } @else {
            Từ <b>{{ homeName() }}</b>, trong <b>{{ zone() }} phút</b> lái xe (đường thông thoáng) đến được <b>{{ z.wards }}/{{ z.total }}</b> phường/xã
            @if (current(); as c) {
              với <b>{{ z.places }}</b> cơ sở {{ c.name.toLowerCase() }}.
              @if (z.top.length) {
                Dày nhất: @for (t of z.top; track t.slug; let last = $last) { <a href="javascript:void(0)" (click)="selected.set(t.slug)">{{ t.name }}</a> ({{ t.count }}){{ last ? '.' : ', ' }} }
              }
            } @else {
              .
            }
          }
          {{ tx().zoneFaded }}
        </p>
      }
      @if (layer() === 'metro' && metroSummary(); as m) {
        <p class="jm__summary" role="status">
          <b>{{ m.horizon.label }}:</b> {{ m.served }}/{{ m.total }} {{ tx().metroWards }} {{ stationKmText() }} {{ tx().metroIn }}@if (m.horizon.id === 'plan') { {{ tx().metroPlan }} }.
          @if (home()) {
            @if (m.homeLines.length) {
              {{ tx().homeLines }} <b>{{ m.homeLines.join(', ') }}</b>; {{ m.same }} {{ tx().homeShare }}
            } @else {
              {{ tx().homeNone }}
            }
          }
        </p>
      }

      @if (layer() === 'sector' && current()?.sparse) {
        <p class="jm__warn">{{ tx().sparse }}</p>
      }

      <div class="jm__grid">
        <div class="jm__mapbox">
          <app-job-map
            [wards]="features()"
            [mode]="mode()"
            [markers]="points()"
            [showMarkers]="showMarkers()"
            [selected]="selected()"
            [home]="home()"
            [theme]="theme()"
            [ariaLabel]="tx().mapAria"
            (wardSelect)="selected.set($event)"
          />
          @if (error()) {
            <p class="jm__error" role="alert">{{ tx().mapError }}</p>
          }
        </div>

        <aside class="jm__side" aria-live="polite">
          @if (figure(); as f) {
            <header class="jm__sidehead">
              <div>
                <h3>{{ f.name }}</h3>
                @if (f.population) {
                  <p class="jm__sub">{{ f.population.toLocaleString(locale()) }} {{ tx().people }}</p>
                }
              </div>
              <button type="button" class="jm__close" (click)="selected.set(null)" [attr.aria-label]="tx().deselect">✕</button>
            </header>

            @if (fromHome(); as fh) {
              <section class="jm__block jm__block--home">
                <span class="jm__k">{{ tx().fromHome(fh.home) }}</span>
                <b class="jm__big">{{ tx().minutes(fh.minutes) }}</b>
                <span class="jm__hint">{{ tx().driveNote }}</span>
              </section>
            }

            <section class="jm__block">
              <h4>{{ current()?.name ?? tx().selectedSector }}</h4>
              @if (f.count !== null) {
                <dl class="jm__stats">
                  <div><dt>{{ tx().places }}</dt><dd>{{ f.count }}</dd></div>
                  @if (f.per10k !== null) {
                    <div><dt>{{ tx().perTenK }}</dt><dd>{{ f.per10k.toLocaleString(locale()) }}</dd></div>
                  }
                </dl>
              } @else {
                <p class="jm__muted">{{ tx().noSectorWard }}</p>
              }
            </section>

            @if (wardMetro(); as m) {
              <section class="jm__block">
                <h4>{{ tx().metroWithin }} {{ stationKmText() }} {{ tx().metroIn }}</h4>
                <dl class="jm__metro">
                  @for (r of m; track r.label) {
                    <div><dt>{{ r.label }}</dt><dd [class.is-none]="r.none">{{ r.text }}</dd></div>
                  }
                </dl>
              </section>
            }

            <section class="jm__block">
              <h4>{{ tx().thick }}</h4>
              @if (detailLoading()) {
                <p class="jm__muted">{{ tx().loading }}</p>
              } @else if (sectors().length) {
                <ol class="jm__sectors">
                  @for (o of sectors(); track o.type) {
                    <li>
                      <span class="jm__lbl"><span aria-hidden="true">{{ o.icon }}</span> {{ o.name }}</span>
                      <span class="jm__bar" aria-hidden="true"><i [style.width.%]="(o.count / sectorMax()) * 100"></i></span>
                      <b>{{ o.count }}</b>
                    </li>
                  }
                </ol>
                <p class="jm__unit">{{ tx().osmCount }}</p>
              } @else {
                <p class="jm__muted">{{ tx().noSectors }}</p>
              }
            </section>

            <div class="jm__actions">
              <button type="button" class="jm__btn" [class.is-on]="home() === f.slug" (click)="homeChange.emit(f.slug)">
                {{ home() === f.slug ? tx().hereNow : tx().imHere }}
              </button>
              <div class="jm__links">
                <a [routerLink]="'/opportunity-map'" [queryParams]="{ ward: f.slug, type: type(), lang: lang() === 'en' ? 'en' : null }">{{ tx().openMap }}</a>
                <a [routerLink]="'/property-intelligence/map'" [queryParams]="{ ward: f.slug, lang: lang() === 'en' ? 'en' : null }">{{ tx().property }}</a>
              </div>
              <app-report-issue kind="ward" [target]="f.slug" [targetName]="f.name" page="career" [lang]="lang()" />
            </div>
          } @else {
            <h3>{{ tx().pickWard }}</h3>
            <p class="jm__muted">{{ tx().pickWardHint }}</p>
          }
        </aside>
      </div>

      <div class="jm__legend" [attr.aria-label]="tx().legend">
        @if (layer() === 'live') {
          @for (l of liveLegend(); track l.label) {
            <span><i [style.background]="l.color"></i>{{ l.label }}</span>
          }
          <span><i [style.background]="noData"></i>{{ tx().legendNoWork }}</span>
          <span><i class="faded"></i>{{ tx().legendOutside }}</span>
        } @else if (layer() === 'metro') {
          @if (home()) {
            <span><i [style.background]="metroColors.same"></i>{{ tx().legendSame }}</span>
          }
          <span><i [style.background]="metroColors.any"></i>{{ home() ? tx().legendMetro : tx().legendMetroKm(stationKmText()) }}</span>
          <span><i [style.background]="noData"></i>{{ tx().legendNoMetro }}</span>
        } @else {
          @for (l of legendItems(); track l.label) {
            <span><i [style.background]="l.color"></i>{{ l.label }}</span>
          }
          <span><i [style.background]="noData"></i>{{ tx().legendNoData }}</span>
          @if (zone()) {
            <span><i class="faded"></i>{{ tx().legendOutZone }}</span>
          }
        }
        @if (showMarkers()) {
          <span><i class="dot dot--plan"></i>{{ tx().legendPole }}</span>
          <span><i class="dot dot--now"></i>{{ tx().legendMark }}</span>
        }
      </div>

      @if (layer() === 'live' && liveSummary(); as ls) {
        <div class="jm__table jm__livetable">
          <h3>{{ tx().liveTitle }}</h3>
          <p class="jm__summary" role="status">
            @if (ls.total === 0) {
              {{ tx().liveNone(ls.names, liveLimit()) }}
            } @else {
              @if (lang() === 'en') {
                <b>{{ ls.total }}</b> wards and communes reach {{ ls.names }} within {{ liveLimit() }} minutes (by car, free-flowing roads).
              } @else {
                <b>{{ ls.total }}</b> phường/xã đi tới {{ ls.names }} trong {{ liveLimit() }} phút (lái xe, đường thông thoáng).
              }
              @if (ls.total > ls.rows.length) { {{ tx().liveTop(ls.rows.length) }} }
            }
          </p>
          @if (ls.rows.length) {
            <div class="jm__scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{{ tx().colWard }}</th>
                    @for (w of ls.workNames; track w) {
                      <th scope="col">{{ tx().colTo(w) }}</th>
                    }
                    <th scope="col" [title]="tx().colLandTitle">{{ tx().colLand }}</th>
                    <th scope="col">{{ tx().colMetro }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of ls.rows; track r.slug) {
                    <tr [class.is-selected]="selected() === r.slug">
                      <th scope="row"><a href="javascript:void(0)" (click)="selected.set(r.slug)">{{ r.name }}</a></th>
                      @for (m of r.minutes; track $index) {
                        <td>{{ tx().minutesCell(m) }}</td>
                      }
                      <td>{{ r.landMedian === null ? '–' : r.landMedian.toLocaleString(locale(), { maximumFractionDigits: 1 }) + ' ' + tx().perM2 }}</td>
                      <td [attr.data-kind]="r.metroFrom ? 'direct' : 'noPlace'">{{ r.metroFrom ? '✓ ' + metroFromText()[r.metroFrom] : '–' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <p class="jm__note">{{ tx().liveNote(stationKmText()) }}</p>
        </div>
      }

      @if (layer() === 'metro' && home() && placeRows().length) {
        <div class="jm__table">
          <h3>{{ tx().metroTitle }}</h3>
          <div class="jm__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">{{ tx().colWork }}</th>
                  @for (h of horizons(); track h.id) {
                    <th scope="col" [class.is-now]="h.id === metroH()">{{ h.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (r of placeRows(); track r.id) {
                  <tr>
                    <th scope="row">{{ r.name }}</th>
                    @for (c of r.cells; track c.id) {
                      <td [class.is-now]="c.id === metroH()" [attr.data-kind]="c.link.kind" [title]="c.title">{{ c.text }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="jm__note">{{ tx().metroNote(stationKmText()) }}</p>
        </div>
      }

      <p class="jm__note">
        {{ caveat() }} {{ tx().endNote1 }}
        {{ tx().endNote2 }}
        {{ tx().endNote3(commuteSource()) }}
      </p>
    </section>
  `,
  styles: `
    :host { display: block; }
    .jm { display: grid; gap: 12px; }
    h2 { margin: 0; font-size: 20px; }
    h3 { margin: 0; font-size: 17px; }
    h4 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--app-ink-dim); }
    .jm__lead { margin: 0; color: var(--app-ink-dim); max-width: 760px; }
    .jm__chips, .jm__controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .jm__controls { gap: 8px 18px; }
    .jm__layers { display: inline-flex; flex-wrap: wrap; gap: 6px; padding: 4px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface-2); align-self: start; width: fit-content; }
    .jm__layers button { padding: 8px 16px; min-height: 40px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
    .jm__layers button[aria-pressed='true'] { background: var(--app-career); color: #fff; }
    .jm__star { color: #d97706; }
    .jm__layers button[aria-pressed='true'] .jm__star { color: #fcd34d; }
    .jm__live { display: grid; gap: 10px; padding: 14px 16px; border: 1px solid var(--app-career); border-radius: 14px; background: linear-gradient(var(--app-career-soft), var(--app-surface) 70%); }
    .jm__livehint { margin: 0; font-size: 13.5px; color: var(--app-ink-dim); max-width: 760px; }
    .jm__livepick { display: flex; flex-wrap: wrap; gap: 10px 16px; }
    .jm__livepick label { display: grid; gap: 4px; font-size: 13px; font-weight: 700; }
    .jm__livepick select { min-height: 40px; min-width: 240px; padding: 6px 10px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface); color: inherit; font: inherit; font-weight: 500; }
    tr.is-selected th, tr.is-selected td { background: var(--app-career-soft); }
    tbody th a { color: var(--app-career); font-weight: 700; }
    .jm__chips button, .jm__seg button { padding: 7px 12px; min-height: 38px; border: 1px solid var(--app-line); border-radius: 999px; background: var(--app-surface-2); color: inherit; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
    .jm__chips button[aria-pressed='true'], .jm__seg button[aria-pressed='true'] { border-color: var(--app-career); background: var(--app-career-soft); color: var(--app-career); }
    .jm__seg button[disabled] { opacity: 0.5; cursor: not-allowed; }
    .jm__seg { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .jm__check { display: inline-flex; gap: 6px; align-items: center; font-size: 13.5px; cursor: pointer; }
    .jm__check input { width: 17px; height: 17px; accent-color: var(--app-career); }
    .jm__home { display: grid; gap: 10px; padding: 14px 16px; border: 1px solid var(--app-career); border-radius: 14px; background: linear-gradient(var(--app-career-soft), var(--app-surface) 70%); }
    .jm__homesel { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-weight: 700; font-size: 14px; }
    .jm__homesel select { min-height: 40px; min-width: 220px; padding: 6px 10px; border: 1px solid var(--app-line); border-radius: 10px; background: var(--app-surface); color: inherit; font: inherit; font-weight: 500; }
    .jm__row { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
    .jm__label { font-size: 13.5px; font-weight: 700; min-width: 150px; }
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--app-career); outline-offset: 2px; }
    .jm__summary { margin: 0; padding: 10px 14px; border-radius: 10px; background: var(--app-surface-2); border: 1px solid var(--app-line); font-size: 14px; }
    .jm__summary a { color: var(--app-career); font-weight: 700; }
    .jm__warn { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--app-time-soft); font-size: 13px; }
    .jm__grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; }
    .jm__mapbox { position: sticky; top: calc(var(--site-nav-h, 56px) + 70px); height: clamp(480px, calc(100dvh - var(--site-nav-h, 56px) - 90px), 760px); border: 1px solid var(--app-line); border-radius: 14px; overflow: hidden; background: var(--app-surface-2); }
    .jm__error { position: absolute; left: 12px; bottom: 12px; margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--app-surface); font-size: 13px; }
    .jm__side { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); align-self: start; position: sticky; top: calc(var(--site-nav-h, 56px) + 70px); max-height: clamp(480px, calc(100dvh - var(--site-nav-h, 56px) - 90px), 760px); overflow-y: auto; }
    .jm__sidehead { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
    .jm__sub { margin: 2px 0 0; font-size: 13px; color: var(--app-ink-dim); }
    .jm__close { width: 32px; height: 32px; flex-shrink: 0; border: 0; border-radius: 8px; background: transparent; color: var(--app-ink-dim); cursor: pointer; font: inherit; }
    .jm__close:hover { background: var(--app-surface-2); }
    .jm__block { display: grid; gap: 6px; padding-top: 12px; border-top: 1px solid var(--app-line); }
    .jm__block h4 { margin: 0; }
    .jm__block--home { grid-template-columns: 1fr auto; align-items: baseline; padding: 10px 12px; border: 1px solid var(--app-career); border-radius: 10px; background: var(--app-career-soft); }
    .jm__k { font-size: 12.5px; font-weight: 700; color: var(--app-ink-dim); grid-column: 1 / -1; }
    .jm__big { font-size: 24px; line-height: 1.1; color: var(--app-career); }
    .jm__hint { font-size: 12.5px; color: var(--app-ink-dim); text-align: right; }
    .jm__muted { margin: 0; font-size: 13.5px; color: var(--app-ink-dim); }
    .jm__stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin: 0; }
    .jm__stats > div { padding: 8px 10px; border-radius: 10px; background: var(--app-surface-2); }
    .jm__stats dt { font-size: 12px; color: var(--app-ink-dim); }
    .jm__stats dd { margin: 0; font-size: 20px; font-weight: 800; }
    .jm__metro { display: grid; gap: 4px; margin: 0; font-size: 13.5px; }
    .jm__metro > div { display: flex; justify-content: space-between; gap: 10px; }
    .jm__metro dt { color: var(--app-ink-dim); }
    .jm__metro dd { margin: 0; font-weight: 700; text-align: right; }
    .jm__metro dd.is-none { font-weight: 500; color: var(--app-ink-faint); }
    .jm__sectors { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 13.5px; }
    .jm__sectors li { display: grid; grid-template-columns: minmax(0, 1fr) 56px auto; align-items: center; gap: 8px; }
    .jm__lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .jm__bar { height: 6px; border-radius: 999px; background: var(--app-line); overflow: hidden; }
    .jm__bar i { display: block; height: 100%; border-radius: inherit; background: var(--app-career); }
    .jm__sectors b { min-width: 22px; text-align: right; color: var(--app-career); }
    .jm__unit { margin: 0; font-size: 11.5px; color: var(--app-ink-faint); }
    .jm__actions { display: grid; gap: 10px; padding-top: 12px; border-top: 1px solid var(--app-line); }
    .jm__btn { width: 100%; }
    .jm__links { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; }
    .jm__links a { color: var(--app-career); font-weight: 700; font-size: 13.5px; }
    .jm__btn { padding: 9px 14px; min-height: 40px; border: 1px solid var(--app-career); border-radius: 999px; background: var(--app-career-soft); color: var(--app-career); font: inherit; font-weight: 700; cursor: pointer; }
    .jm__btn.is-on { background: var(--app-career); color: #fff; }
    .jm__legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--app-ink-dim); }
    .jm__legend span { display: inline-flex; align-items: center; gap: 6px; }
    .jm__legend i { width: 18px; height: 12px; border-radius: 3px; display: inline-block; }
    .jm__legend i.faded { background: var(--app-ink-faint); opacity: 0.25; }
    .jm__legend i.dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--app-line); }
    .dot--plan { background: #f59e0b; }
    .dot--now { background: #2563eb; }
    .jm__table { display: grid; gap: 8px; }
    .jm__scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th, td { padding: 7px 10px; border-bottom: 1px solid var(--app-line); text-align: left; vertical-align: top; }
    thead th { font-size: 12.5px; color: var(--app-ink-dim); }
    tbody th { font-weight: 600; }
    td.is-now, th.is-now { background: var(--app-career-soft); }
    td[data-kind='direct'] { color: var(--app-career); font-weight: 700; }
    td[data-kind='noHome'], td[data-kind='noPlace'] { color: var(--app-ink-faint); }
    .jm__note { margin: 0; font-size: 12.5px; color: var(--app-ink-dim); }
    @media (max-width: 860px) {
      .jm__grid { grid-template-columns: 1fr; }
      .jm__mapbox { position: relative; top: auto; height: 420px; }
      .jm__side { position: static; max-height: none; }
      .jm__label { min-width: 0; width: 100%; }
    }
  `,
})
export class JobMapSectionComponent {
  private readonly api = inject(OpportunityService);
  private readonly pi = inject(PiApiService);
  protected readonly theme = inject(ThemeService).effective;

  /** The slug of the ward the visitor lives in (outlined on the map). */
  readonly home = input<string | null>(null);
  /** "Tôi ở phường này": the visitor says where they live. */
  readonly homeChange = output<string>();
  /** The language of the page. */
  readonly lang = input<CareerLang>('vi');
  protected readonly tx = computed(() => JOBMAP_TEXT[this.lang()]);
  protected readonly locale = computed(() => localeOf(this.lang()));

  protected readonly noData = NO_DATA;
  protected readonly metroColors = METRO_COLORS;
  protected readonly zones = ZONES;
  protected readonly horizons = computed(() => metroHorizonsIn(this.lang()));
  protected readonly points = computed(() => markers(areasIn(this.lang())));
  protected readonly type = signal(DEFAULT_TYPE);
  protected readonly metric = signal<Metric>('count');
  protected readonly showMarkers = signal(true);
  protected readonly selected = signal<string | null>(null);
  /** The drive-time limit (null: every ward). */
  protected readonly zone = signal<Zone | null>(null);
  /** The metro horizon (null: the map shows the sector instead). */
  protected readonly metroH = signal<MetroHorizon>('now');
  /** What the map colours by: a sector, the metro, or the wards that suit the workplaces chosen (Premium). */
  protected readonly layer = signal<'sector' | 'metro' | 'live'>('sector');
  protected readonly mode = computed<MapMode>(() => (this.layer() === 'metro' ? 'metro' : 'sector'));
  protected readonly locked = inject(BillingService).premiumLocked;
  private readonly premiumPrompt = inject(PremiumPromptService);

  // ---- where to live for the work (Premium)
  protected readonly liveLimits = LIVE_LIMITS;
  protected readonly metroFromText = computed(() => metroFromTextIn(this.lang()));
  protected readonly workA = signal<string | null>(null);
  protected readonly workB = signal<string | null>(null);
  protected readonly liveLimit = signal<LiveLimit>(30);
  protected readonly liveSort = signal<LiveSort>('time');
  /** The reference places a workplace can be (their times to every ward come with the travel data). */
  protected readonly placeOptions = computed(() => Object.values(areasIn(this.lang())).filter((a) => a.routed).map((a) => ({ id: a.id, name: a.name })));
  protected readonly liveLegend = computed(() => {
    const l = this.tx().liveLegend;
    return [
      { color: RAMP[4], label: l.near },
      { color: RAMP[2], label: l.mid },
      { color: RAMP[0], label: l.far },
    ];
  });

  protected setLayer(layer: 'sector' | 'metro' | 'live'): void {
    if (layer === 'live' && this.locked()) return this.premiumPrompt.open(this.tx().liveAsk, this.lang());
    this.layer.set(layer);
    this.selected.set(null);
  }

  protected readonly types = toSignal(
    toObservable(this.lang).pipe(
      switchMap((lang) =>
        this.api.types(lang).pipe(
          map((r) => r.types),
          catchError(() => of([])),
        ),
      ),
    ),
    { initialValue: [] },
  );
  protected readonly current = computed(() => this.types().find((t) => t.key === this.type()) ?? null);

  private readonly response = signal<WardsResponse | null>(null);
  protected readonly error = signal(false);

  /** Driving times from home, and the metro lines near every ward and place. */
  private readonly commute = toSignal(
    toObservable(computed(() => ({ slug: this.home(), lang: this.lang() }))).pipe(switchMap(({ slug, lang }) => (slug ? this.pi.commute(slug, lang).pipe(catchError(() => of(null))) : of(null)))),
    { initialValue: null },
  );
  private readonly metro = toSignal(this.pi.metroReach().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly timesA = toSignal(toObservable(computed(() => ({ t: this.workA(), lang: this.lang() }))).pipe(switchMap(({ t, lang }) => (t ? this.pi.commuteTo(t, lang).pipe(catchError(() => of(null))) : of(null)))), { initialValue: null });
  private readonly timesB = toSignal(toObservable(computed(() => ({ t: this.workB(), lang: this.lang() }))).pipe(switchMap(({ t, lang }) => (t ? this.pi.commuteTo(t, lang).pipe(catchError(() => of(null))) : of(null)))), { initialValue: null });
  protected readonly stationKmText = computed(() => (this.metro()?.stationKm ?? 1.5).toLocaleString(this.locale()));
  protected readonly commuteSource = computed(() => this.commute()?.source ?? this.tx().defaultSource);

  protected readonly wardOptions = computed(() =>
    (this.response()?.features ?? [])
      .map((f) => figureOf(f.properties as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  );
  protected readonly homeName = computed(() => this.wardOptions().find((w) => w.slug === this.home())?.name ?? '');

  private readonly limits = computed(() => {
    const m = this.metric();
    return breaks((this.response()?.features ?? []).map((f) => figureOf(f.properties as Record<string, unknown>)[m]));
  });

  private readonly figures = computed(() => (this.response()?.features ?? []).map((f) => figureOf(f.properties as Record<string, unknown>)));

  /** The zone you can reach from home, when a limit is chosen and the driving times are loaded. */
  protected readonly zoneSummary = computed(() => {
    const zone = this.zone();
    const commute = this.commute();
    return zone && commute && this.home() ? reachSummary(commute.minutes, zone, this.figures()) : null;
  });

  /** The workplaces chosen, with the minutes from every ward and the metro near each. */
  private readonly workplaces = computed<Workplace[]>(() => {
    const metro = this.metro();
    const place = (id: string | null, times: { name: string; minutes: Record<string, number | null> } | null): Workplace | null => {
      if (!id || !times) return null;
      const point: MetroPoint | null = (AREAS[id] ? metro?.places[id] : metro?.wards[id]) ?? null;
      return { id, name: times.name, minutes: times.minutes, metro: point };
    };
    return [place(this.workA(), this.timesA()), place(this.workB(), this.timesB())].filter((w): w is Workplace => w !== null);
  });

  /** The wards that suit the workplaces, best first, and what to print above them. */
  private readonly liveRows = computed(() => {
    const metro = this.metro();
    const candidates = this.figures().map((f) => ({ slug: f.slug, name: f.name, landMedian: f.landMedian }));
    return rankHomes(candidates, this.workplaces(), this.liveLimit(), this.liveSort(), (slug) => metro?.wards[slug]);
  });
  protected readonly liveSummary = computed(() => {
    const works = this.workplaces();
    if (this.layer() !== 'live' || works.length === 0) return null;
    const rows = this.liveRows();
    return { total: rows.length, rows: rows.slice(0, 12), names: works.map((w) => w.name).join(this.tx().and), workNames: works.map((w) => w.name) };
  });

  /** Metro: how many wards are served at the chosen horizon, and how many share a line with home. */
  protected readonly metroSummary = computed(() => {
    const h = this.metroH();
    const metro = this.metro();
    if (this.layer() !== 'metro' || !metro) return null;
    const home = this.home() ? (metro.wards[this.home() as string] ?? null) : null;
    const wards = Object.values(metro.wards);
    return {
      horizon: this.horizons().find((x) => x.id === h)!,
      served: wards.filter((w) => w.lines[h].length).length,
      total: wards.length,
      homeLines: home?.lines[h] ?? [],
      same: Object.entries(metro.wards).filter(([slug, w]) => slug !== this.home() && metroClass(w, home, h) === 'same').length,
    };
  });

  /** The ward polygons with what the map colours by: the sector class, the fade outside the zone, and the metro class. */
  protected readonly features = computed<GeoJSON.FeatureCollection | null>(() => {
    const r = this.response();
    if (!r) return null;
    const m = this.metric();
    const limits = this.limits();
    const zone = this.layer() === 'sector' ? this.zoneSummary() : null;
    const metro = this.metro();
    const h = this.layer() === 'metro' ? this.metroH() : null;
    const live = this.layer() === 'live' && this.workplaces().length ? this.liveRows() : null;
    const liveClass = live ? liveClasses(live) : null;
    const homePoint = metro && this.home() ? (metro.wards[this.home() as string] ?? null) : null;
    return {
      type: 'FeatureCollection',
      features: r.features.map((f) => {
        const props = (f.properties ?? {}) as Record<string, unknown>;
        const slug = String(props['slug'] ?? '');
        const cls = liveClass ? (liveClass.get(slug) ?? null) : this.layer() === 'sector' ? classOf(figureOf(props)[m], limits) : null;
        const { cls: _c, out: _o, mc: _m, ...rest } = props;
        return {
          ...f,
          properties: {
            ...rest,
            ...(cls === null ? {} : { cls }),
            ...(zone && !zone.inRange.has(slug) ? { out: true } : {}),
            ...(liveClass && !liveClass.has(slug) ? { out: true } : {}),
            ...(h && metro ? { mc: metroClass(metro.wards[slug], homePoint, h) } : {}),
          },
        };
      }),
    };
  });

  protected readonly legendItems = computed(() => legend(this.limits(), this.metric() === 'per10k' ? 1 : 0, this.lang()));
  protected readonly caveat = computed(() => this.response()?.meta.caveat ?? this.tx().caveatDefault);

  protected readonly figure = computed(() => {
    const slug = this.selected();
    return slug ? (this.figures().find((f) => f.slug === slug) ?? null) : null;
  });

  /** "From home: 23 minutes by car", for the chosen ward. */
  protected readonly fromHome = computed(() => {
    const slug = this.selected();
    const commute = this.commute();
    if (!slug || !commute || !this.home() || slug === this.home()) return null;
    const minutes = commute.minutes[slug];
    return minutes === null || minutes === undefined ? null : { home: this.homeName(), minutes };
  });

  /** The metro lines near the chosen ward at the three horizons. */
  protected readonly wardMetro = computed(() => {
    const slug = this.selected();
    const point = slug ? this.metro()?.wards[slug] : null;
    if (!point) return null;
    const tx = this.tx();
    const row = (label: string, h: MetroHorizon) => ({ label, text: point.lines[h].length ? tx.line(point.lines[h].join(', ')) : tx.noneYet, none: point.lines[h].length === 0 });
    return [row(tx.horizonNow, 'now'), row(tx.horizonSoon, 'soon'), row(tx.horizonPlan, 'plan')];
  });

  /** The places of work and whether home shares a metro line with each, at the three horizons. */
  protected readonly placeRows = computed(() => {
    const metro = this.metro();
    const home = metro && this.home() ? (metro.wards[this.home() as string] ?? null) : null;
    if (!metro || !home) return [];
    const areas = areasIn(this.lang());
    const linkText = linkTextIn(this.lang());
    return Object.keys(areas)
      .filter((id) => metro.places[id])
      .map((id) => ({
        id,
        name: areas[id].name,
        cells: this.horizons().map((h) => {
          const link = metroLink(home, metro.places[id], h.id);
          return { id: h.id, link, text: this.cellText(link), title: linkText[link.kind] };
        }),
      }));
  });

  private cellText(link: MetroLink): string {
    const c = this.tx().metroCell;
    return link.kind === 'direct' ? c.line(link.lines.join(', ')) : link.kind === 'transfer' ? c.transfer : '–';
  }

  private readonly detail = signal<WardDetail | null>(null);
  protected readonly detailLoading = computed(() => !!this.selected() && this.detail()?.slug !== this.selected());
  /** The most places of any sector listed, for the length of the bars. */
  protected readonly sectorMax = computed(() => Math.max(1, ...this.sectors().map((o) => o.count)));
  protected readonly sectors = computed<Opportunity[]>(() => (this.detail()?.slug === this.selected() ? topSectors(this.detail()?.opportunities ?? []) : []));

  constructor() {
    // The wards of the chosen sector.
    toObservable(computed(() => ({ type: this.type(), lang: this.lang() })))
      .pipe(
        switchMap(({ type, lang }) => {
          this.error.set(false);
          return this.api.wards(type, 'now', lang).pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.response.set(r));

    // The sectors around the chosen ward.
    toObservable(computed(() => ({ slug: this.selected(), lang: this.lang() })))
      .pipe(
        switchMap(({ slug, lang }) => (slug ? this.api.ward(slug, 'now', lang).pipe(catchError(() => of(null))) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe((d) => this.detail.set(d));

    // If the default sector is not offered, start from the first one that is.
    effect(() => {
      const types = this.types();
      if (types.length && !types.some((t) => t.key === untracked(this.type))) untracked(() => this.type.set(types[0].key));
    });

    // Without Premium the live layer is closed.
    effect(() => {
      if (this.locked() && untracked(this.layer) === 'live') untracked(() => this.layer.set('sector'));
    });

    // Without a home there is no zone to draw.
    effect(() => {
      if (!this.home() && untracked(this.zone) !== null) untracked(() => this.zone.set(null));
    });
  }
}
