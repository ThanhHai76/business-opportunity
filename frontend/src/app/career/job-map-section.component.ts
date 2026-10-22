import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { OpportunityService } from '../opportunity/op.service';
import { Opportunity, WardDetail, WardsResponse } from '../opportunity/op.models';
import { MetroHorizon, MetroPoint } from '../property-intel/pi.models';
import { PiApiService } from '../property-intel/pi.service';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { ThemeService } from '../services/theme.service';
import { AREAS } from './career.data';
import { LIVE_LIMITS, LiveLimit, LiveSort, METRO_FROM_TEXT, Workplace, liveClasses, rankHomes } from './career.live';
import { Metric, NO_DATA, RAMP, breaks, classOf, figureOf, legend, markers, topSectors } from './career.jobmap';
import { LINK_TEXT, METRO_HORIZONS, MetroLink, ZONES, Zone, metroClass, metroLink, reachSummary } from './career.reach';
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
  imports: [RouterLink, JobMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="jm" aria-labelledby="jm-title">
      <h2 id="jm-title">Bản đồ ngành nghề theo khu vực</h2>
      <p class="jm__lead">
        Chọn một ngành dịch vụ để thấy phường nào có nhiều cơ sở của ngành đó trên bản đồ. Đây là dấu hiệu nơi ngành tập trung,
        <strong>không phải số vị trí đang tuyển</strong>. Chọn phường bạn ở để xem vùng đi làm và metro. Bấm vào một phường để xem những ngành đang dày quanh đó.
      </p>

      <div class="jm__layers" role="group" aria-label="Lớp bản đồ">
        <button type="button" [attr.aria-pressed]="layer() === 'sector'" (click)="setLayer('sector')">Ngành nghề</button>
        <button type="button" [attr.aria-pressed]="layer() === 'metro'" (click)="setLayer('metro')">Metro</button>
        <button type="button" [attr.aria-pressed]="layer() === 'live'" (click)="setLayer('live')">Nơi ở theo nơi làm @if (locked()) { <span class="jm__star" aria-hidden="true">★</span> }</button>
      </div>

      @if (layer() === 'sector') {
        <div class="jm__chips" role="group" aria-label="Ngành">
          @for (t of types(); track t.key) {
            <button type="button" [attr.aria-pressed]="type() === t.key" (click)="type.set(t.key); selected.set(null)">{{ t.icon }} {{ t.name }}</button>
          }
        </div>
        <div class="jm__controls">
          <div class="jm__seg" role="group" aria-label="Cách tô màu theo ngành">
            <button type="button" [attr.aria-pressed]="metric() === 'count'" (click)="metric.set('count')">Số cơ sở</button>
            <button type="button" [attr.aria-pressed]="metric() === 'per10k'" (click)="metric.set('per10k')">Mật độ trên 10.000 dân</button>
          </div>
        </div>
      }
      <label class="jm__check"><input type="checkbox" [checked]="showMarkers()" (change)="showMarkers.set($any($event.target).checked)" /> Hiện cực theo quy hoạch và điểm mốc</label>

      <div class="jm__home" role="group" aria-label="Từ nhà bạn">
        <label class="jm__homesel">
          <span>Nhà bạn ở</span>
          <select aria-label="Phường hoặc xã bạn đang ở" [value]="home() ?? ''" (change)="homeChange.emit($any($event.target).value)">
            <option value="">Chưa chọn</option>
            @for (w of wardOptions(); track w.slug) {
              <option [value]="w.slug" [selected]="w.slug === home()">{{ w.name }}</option>
            }
          </select>
        </label>
        @if (layer() === 'sector') {
          <div class="jm__row">
            <span class="jm__label">Đi làm bằng ô tô, trong</span>
            <div class="jm__seg" role="group" aria-label="Vùng đi làm bằng ô tô">
              <button type="button" [attr.aria-pressed]="zone() === null" (click)="zone.set(null)">Tất cả</button>
              @for (z of zones; track z) {
                <button type="button" [attr.aria-pressed]="zone() === z" [disabled]="!home()" [title]="home() ? 'Lái xe, đường thông thoáng' : 'Chọn phường bạn ở trước'" (click)="zone.set(z)">{{ z }} phút</button>
              }
            </div>
          </div>
        }
        @if (layer() === 'metro') {
          <div class="jm__row">
            <span class="jm__label">Metro ở mốc</span>
            <div class="jm__seg" role="group" aria-label="Mốc thời gian của metro">
              @for (h of horizons; track h.id) {
                <button type="button" [attr.aria-pressed]="metroH() === h.id" [title]="h.hint" (click)="metroH.set(h.id)">{{ h.label }}</button>
              }
            </div>
          </div>
        }
      </div>

      @if (layer() === 'live') {
        <div class="jm__live" role="group" aria-label="Nơi ở theo nơi làm">
          <p class="jm__livehint">
            Chọn nơi làm của bạn (và của người cùng ở, nếu có). Bản đồ tô các phường/xã mà từ đó đi tới mọi nơi làm trong giới hạn thời gian; càng gần càng đậm.
          </p>
          <div class="jm__livepick">
            <label>
              <span>Nơi làm 1</span>
              <select aria-label="Nơi làm thứ nhất" [value]="workA() ?? ''" (change)="workA.set($any($event.target).value || null)">
                <option value="">Chọn nơi làm</option>
                <optgroup label="Điểm mốc">
                  @for (p of placeOptions; track p.id) {
                    <option [value]="p.id" [selected]="p.id === workA()">{{ p.name }}</option>
                  }
                </optgroup>
                <optgroup label="Phường/xã">
                  @for (w of wardOptions(); track w.slug) {
                    <option [value]="w.slug" [selected]="w.slug === workA()">{{ w.name }}</option>
                  }
                </optgroup>
              </select>
            </label>
            <label>
              <span>Nơi làm 2 (không bắt buộc)</span>
              <select aria-label="Nơi làm thứ hai" [value]="workB() ?? ''" (change)="workB.set($any($event.target).value || null)">
                <option value="">Không có</option>
                <optgroup label="Điểm mốc">
                  @for (p of placeOptions; track p.id) {
                    <option [value]="p.id" [selected]="p.id === workB()">{{ p.name }}</option>
                  }
                </optgroup>
                <optgroup label="Phường/xã">
                  @for (w of wardOptions(); track w.slug) {
                    <option [value]="w.slug" [selected]="w.slug === workB()">{{ w.name }}</option>
                  }
                </optgroup>
              </select>
            </label>
          </div>
          <div class="jm__row">
            <span class="jm__label">Mỗi nơi làm, tối đa</span>
            <div class="jm__seg" role="group" aria-label="Giới hạn thời gian">
              @for (l of liveLimits; track l) {
                <button type="button" [attr.aria-pressed]="liveLimit() === l" (click)="liveLimit.set(l)">{{ l }} phút</button>
              }
            </div>
          </div>
          <div class="jm__row">
            <span class="jm__label">Xếp theo</span>
            <div class="jm__seg" role="group" aria-label="Cách xếp">
              <button type="button" [attr.aria-pressed]="liveSort() === 'time'" (click)="liveSort.set('time')">Gần nơi làm nhất</button>
              <button type="button" [attr.aria-pressed]="liveSort() === 'price'" (click)="liveSort.set('price')">Giá đất thấp nhất</button>
            </div>
          </div>
        </div>
      }

      @if (layer() === 'sector' && zoneSummary(); as z) {
        <p class="jm__summary" role="status">
          Từ <b>{{ homeName() }}</b>, trong <b>{{ zone() }} phút</b> lái xe (đường thông thoáng) đến được <b>{{ z.wards }}/{{ z.total }}</b> phường/xã
          @if (current(); as c) {
            với <b>{{ z.places }}</b> cơ sở {{ c.name.toLowerCase() }}.
            @if (z.top.length) {
              Dày nhất: @for (t of z.top; track t.slug; let last = $last) { <a href="javascript:void(0)" (click)="selected.set(t.slug)">{{ t.name }}</a> ({{ t.count }}){{ last ? '.' : ', ' }} }
            }
          } @else {
            .
          }
          Phường ngoài vùng bị làm mờ. Giờ cao điểm thường lâu hơn nhiều, nên coi đây là vùng gần nhất có thể.
        </p>
      }
      @if (layer() === 'metro' && metroSummary(); as m) {
        <p class="jm__summary" role="status">
          <b>{{ m.horizon.label }}:</b> {{ m.served }}/{{ m.total }} phường/xã có ga metro trong {{ stationKmText() }} km@if (m.horizon.id === 'plan') { hoặc nằm gần hành lang tuyến theo quy hoạch (sơ đồ, chưa có vị trí ga) }.
          @if (home()) {
            @if (m.homeLines.length) {
              Nhà bạn đi được tuyến <b>{{ m.homeLines.join(', ') }}</b>; {{ m.same }} phường/xã khác nằm trên cùng tuyến.
            } @else {
              Nhà bạn chưa gần ga ở mốc này.
            }
          }
        </p>
      }

      @if (layer() === 'sector' && current()?.sparse) {
        <p class="jm__warn">Ngành này có rất ít cơ sở trên bản đồ OpenStreetMap, nên màu sắc chưa đáng tin. Hãy xem các ngành khác hoặc khảo sát thực tế.</p>
      }

      <div class="jm__grid">
        <div class="jm__mapbox">
          <app-job-map
            [wards]="features()"
            [mode]="mode()"
            [markers]="points"
            [showMarkers]="showMarkers()"
            [selected]="selected()"
            [home]="home()"
            [theme]="theme()"
            ariaLabel="Bản đồ các phường Hà Nội tô màu theo ngành đã chọn hoặc theo metro"
            (wardSelect)="selected.set($event)"
          />
          @if (error()) {
            <p class="jm__error" role="alert">Chưa tải được dữ liệu bản đồ. Hãy thử lại sau.</p>
          }
        </div>

        <aside class="jm__side" aria-live="polite">
          @if (figure(); as f) {
            <h3>{{ f.name }}</h3>
            <p class="jm__muted">
              @if (f.population) {
                {{ f.population.toLocaleString('vi-VN') }} dân ·
              }
              @if (f.count !== null) {
                {{ current()?.name }}: <b>{{ f.count }} cơ sở</b>@if (f.per10k !== null) { ({{ f.per10k.toLocaleString('vi-VN') }} trên 10.000 dân) }
              } @else {
                chưa có dữ liệu ngành này ở phường
              }
            </p>
            @if (fromHome(); as t) {
              <p class="jm__from">{{ t }}</p>
            }
            @if (wardMetro(); as lines) {
              <p class="jm__muted">Metro trong {{ stationKmText() }} km: nay <b>{{ lines.now }}</b> · 2027 <b>{{ lines.soon }}</b> · quy hoạch <b>{{ lines.plan }}</b></p>
            }
            <h4>Ngành đang dày quanh đây</h4>
            @if (detailLoading()) {
              <p class="jm__muted">Đang tải…</p>
            } @else if (sectors().length) {
              <ol class="jm__sectors">
                @for (o of sectors(); track o.type) {
                  <li><span aria-hidden="true">{{ o.icon }}</span> {{ o.name }} <b>{{ o.count }}</b></li>
                }
              </ol>
            } @else {
              <p class="jm__muted">Chưa có dữ liệu các ngành ở phường này.</p>
            }
            <div class="jm__actions">
              <button type="button" class="jm__btn" [class.is-on]="home() === f.slug" (click)="homeChange.emit(f.slug)">
                {{ home() === f.slug ? '✓ Phường bạn đang ở' : 'Tôi ở phường này' }}
              </button>
              <a [routerLink]="'/opportunity-map'" [queryParams]="{ ward: f.slug, type: type() }">Mở gì ở đâu →</a>
              <a [routerLink]="'/property-intelligence/map'" [queryParams]="{ ward: f.slug }">Chấm điểm bất động sản →</a>
            </div>
          } @else {
            <h3>Chọn một phường</h3>
            <p class="jm__muted">Bấm vào một phường trên bản đồ để xem chi tiết: số cơ sở của ngành đã chọn, những ngành đang dày quanh đó, thời gian từ nhà bạn và metro gần đó.</p>
          }
        </aside>
      </div>

      <div class="jm__legend" aria-label="Chú giải">
        @if (layer() === 'live') {
          @for (l of liveLegend; track l.label) {
            <span><i [style.background]="l.color"></i>{{ l.label }}</span>
          }
          <span><i [style.background]="noData"></i>Chưa chọn nơi làm</span>
          <span><i class="faded"></i>Ngoài giới hạn thời gian</span>
        } @else if (layer() === 'metro') {
          @if (home()) {
            <span><i [style.background]="metroColors.same"></i>Cùng tuyến metro với nhà bạn</span>
          }
          <span><i [style.background]="metroColors.any"></i>{{ home() ? 'Có metro, khác tuyến' : 'Có metro trong ' + stationKmText() + ' km' }}</span>
          <span><i [style.background]="noData"></i>Chưa có metro</span>
        } @else {
          @for (l of legendItems(); track l.label) {
            <span><i [style.background]="l.color"></i>{{ l.label }}</span>
          }
          <span><i [style.background]="noData"></i>Chưa có dữ liệu</span>
          @if (zone()) {
            <span><i class="faded"></i>Ngoài vùng đi làm</span>
          }
        }
        @if (showMarkers()) {
          <span><i class="dot dot--plan"></i>Cực theo quy hoạch</span>
          <span><i class="dot dot--now"></i>Điểm mốc (Hồ Gươm, Cầu Giấy – Duy Tân, Nội Bài)</span>
        }
      </div>

      @if (layer() === 'live' && liveSummary(); as ls) {
        <div class="jm__table jm__livetable">
          <h3>Nơi ở gợi ý</h3>
          <p class="jm__summary" role="status">
            @if (ls.total === 0) {
              Không có phường/xã nào đi tới {{ ls.names }} trong {{ liveLimit() }} phút. Thử nới giới hạn thời gian.
            } @else {
              <b>{{ ls.total }}</b> phường/xã đi tới {{ ls.names }} trong {{ liveLimit() }} phút (lái xe, đường thông thoáng).
              @if (ls.total > ls.rows.length) { Đang hiện {{ ls.rows.length }} phường/xã đứng đầu. }
            }
          </p>
          @if (ls.rows.length) {
            <div class="jm__scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Phường/xã</th>
                    @for (w of ls.workNames; track w) {
                      <th scope="col">Tới {{ w }}</th>
                    }
                    <th scope="col" title="Giá đất nhà nước, trung vị VT1, triệu đồng/m²: thường thấp hơn giá thị trường">Giá đất NN</th>
                    <th scope="col">Metro cùng tuyến</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of ls.rows; track r.slug) {
                    <tr [class.is-selected]="selected() === r.slug">
                      <th scope="row"><a href="javascript:void(0)" (click)="selected.set(r.slug)">{{ r.name }}</a></th>
                      @for (m of r.minutes; track $index) {
                        <td>{{ m }} phút</td>
                      }
                      <td>{{ r.landMedian === null ? '–' : r.landMedian.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr/m²' }}</td>
                      <td [attr.data-kind]="r.metroFrom ? 'direct' : 'noPlace'">{{ r.metroFrom ? '✓ ' + metroFromText[r.metroFrom] : '–' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <p class="jm__note">
            Thời gian là lái ô tô giữa tâm các phường/xã, đường thông thoáng; giờ cao điểm lâu hơn nhiều. Giá đất là bảng giá nhà nước 2026, chỉ là dấu hiệu thô về chi phí ở, không phải giá thuê hay giá bán.
            "Metro cùng tuyến" nghĩa là ga trong {{ stationKmText() }} km quanh nhà và quanh mọi nơi làm có chung một tuyến; chưa có thời gian đi metro. Đây là gợi ý để đi xem, không thay cho khảo sát thực tế.
          </p>
        </div>
      }

      @if (layer() === 'metro' && home() && placeRows().length) {
        <div class="jm__table">
          <h3>Nhà bạn nối với nơi làm việc bằng metro không?</h3>
          <div class="jm__scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nơi làm việc</th>
                  @for (h of horizons; track h.id) {
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
          <p class="jm__note">
            Chỉ cho biết nhà và nơi làm có cùng một tuyến metro trong {{ stationKmText() }} km quanh ga hay không; dữ liệu chưa có thời gian đi hay lịch chạy. Ô "Khác tuyến" có thể vẫn đi được bằng cách đổi tuyến.
            Mốc quy hoạch chỉ là hành lang sơ đồ của tuyến dự kiến, chưa có vị trí ga.
          </p>
        </div>
      }

      <p class="jm__note">
        {{ caveat() }} Số cơ sở khác số vị trí tuyển dụng: chỉ dùng để thấy ngành nào tập trung ở đâu. Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm.
        Công nghiệp, bán dẫn, logistics và xây dựng không có số cơ sở đáng tin trên bản đồ nên không tô màu; hãy xem lớp quy hoạch và mục "Nơi làm việc" của từng hướng nghề.
        Thời gian đi lại tính bằng ô tô giữa tâm các phường/xã, đường thông thoáng ({{ commuteSource() }}); xe máy nhiều khi nhanh hơn, giờ cao điểm lâu hơn nhiều.
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
    .jm__mapbox { position: relative; height: 540px; border: 1px solid var(--app-line); border-radius: 14px; overflow: hidden; background: var(--app-surface-2); }
    .jm__error { position: absolute; left: 12px; bottom: 12px; margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--app-surface); font-size: 13px; }
    .jm__side { padding: 16px; border: 1px solid var(--app-line); border-radius: 14px; background: var(--app-surface); align-self: start; }
    .jm__muted { margin: 4px 0 0; font-size: 13.5px; color: var(--app-ink-dim); }
    .jm__from { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--app-career); }
    .jm__sectors { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 14px; }
    .jm__sectors b { float: right; color: var(--app-career); }
    .jm__actions { display: grid; gap: 8px; margin-top: 14px; }
    .jm__actions a { color: var(--app-career); font-weight: 700; font-size: 14px; }
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
      .jm__mapbox { height: 420px; }
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

  protected readonly noData = NO_DATA;
  protected readonly metroColors = METRO_COLORS;
  protected readonly zones = ZONES;
  protected readonly horizons = METRO_HORIZONS;
  protected readonly points = markers();
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
  protected readonly metroFromText = METRO_FROM_TEXT;
  protected readonly workA = signal<string | null>(null);
  protected readonly workB = signal<string | null>(null);
  protected readonly liveLimit = signal<LiveLimit>(30);
  protected readonly liveSort = signal<LiveSort>('time');
  /** The reference places a workplace can be (their times to every ward come with the travel data). */
  protected readonly placeOptions = Object.values(AREAS).filter((a) => a.routed).map((a) => ({ id: a.id, name: a.name }));
  protected readonly liveLegend = [
    { color: RAMP[4], label: 'Gần nơi làm nhất' },
    { color: RAMP[2], label: 'Vừa' },
    { color: RAMP[0], label: 'Xa hơn (vẫn trong giới hạn)' },
  ];

  protected setLayer(layer: 'sector' | 'metro' | 'live'): void {
    if (layer === 'live' && this.locked()) return this.premiumPrompt.open('Tìm nơi ở theo nơi làm', 'vi');
    this.layer.set(layer);
    this.selected.set(null);
  }

  protected readonly types = toSignal(
    this.api.types('vi').pipe(
      map((r) => r.types),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  protected readonly current = computed(() => this.types().find((t) => t.key === this.type()) ?? null);

  private readonly response = signal<WardsResponse | null>(null);
  protected readonly error = signal(false);

  /** Driving times from home, and the metro lines near every ward and place. */
  private readonly commute = toSignal(
    toObservable(this.home).pipe(switchMap((slug) => (slug ? this.pi.commute(slug, 'vi').pipe(catchError(() => of(null))) : of(null)))),
    { initialValue: null },
  );
  private readonly metro = toSignal(this.pi.metroReach().pipe(catchError(() => of(null))), { initialValue: null });
  private readonly timesA = toSignal(toObservable(this.workA).pipe(switchMap((t) => (t ? this.pi.commuteTo(t, 'vi').pipe(catchError(() => of(null))) : of(null)))), { initialValue: null });
  private readonly timesB = toSignal(toObservable(this.workB).pipe(switchMap((t) => (t ? this.pi.commuteTo(t, 'vi').pipe(catchError(() => of(null))) : of(null)))), { initialValue: null });
  protected readonly stationKmText = computed(() => (this.metro()?.stationKm ?? 1.5).toLocaleString('vi-VN'));
  protected readonly commuteSource = computed(() => this.commute()?.source ?? 'OSRM trên đường OpenStreetMap');

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
    return { total: rows.length, rows: rows.slice(0, 12), names: works.map((w) => w.name).join(' và '), workNames: works.map((w) => w.name) };
  });

  /** Metro: how many wards are served at the chosen horizon, and how many share a line with home. */
  protected readonly metroSummary = computed(() => {
    const h = this.metroH();
    const metro = this.metro();
    if (this.layer() !== 'metro' || !metro) return null;
    const home = this.home() ? (metro.wards[this.home() as string] ?? null) : null;
    const wards = Object.values(metro.wards);
    return {
      horizon: this.horizons.find((x) => x.id === h)!,
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

  protected readonly legendItems = computed(() => legend(this.limits(), this.metric() === 'per10k' ? 1 : 0));
  protected readonly caveat = computed(() => this.response()?.meta.caveat ?? 'OpenStreetMap do cộng đồng đóng góp và chưa ghi nhận đủ cửa hàng nhỏ.');

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
    return minutes === null || minutes === undefined ? null : `Từ ${this.homeName()}: khoảng ${minutes} phút lái xe (đường thông thoáng)`;
  });

  /** The metro lines near the chosen ward at the three horizons. */
  protected readonly wardMetro = computed(() => {
    const slug = this.selected();
    const point = slug ? this.metro()?.wards[slug] : null;
    if (!point) return null;
    const text = (h: MetroHorizon) => (point.lines[h].length ? point.lines[h].join(', ') : 'chưa có');
    return { now: text('now'), soon: text('soon'), plan: text('plan') };
  });

  /** The places of work and whether home shares a metro line with each, at the three horizons. */
  protected readonly placeRows = computed(() => {
    const metro = this.metro();
    const home = metro && this.home() ? (metro.wards[this.home() as string] ?? null) : null;
    if (!metro || !home) return [];
    return Object.keys(AREAS)
      .filter((id) => metro.places[id])
      .map((id) => ({
        id,
        name: AREAS[id].name,
        cells: this.horizons.map((h) => {
          const link = metroLink(home, metro.places[id], h.id);
          return { id: h.id, link, text: this.cellText(link), title: LINK_TEXT[link.kind] };
        }),
      }));
  });

  private cellText(link: MetroLink): string {
    return link.kind === 'direct' ? `✓ tuyến ${link.lines.join(', ')}` : link.kind === 'transfer' ? 'Khác tuyến' : '–';
  }

  private readonly detail = signal<WardDetail | null>(null);
  protected readonly detailLoading = computed(() => !!this.selected() && this.detail()?.slug !== this.selected());
  protected readonly sectors = computed<Opportunity[]>(() => (this.detail()?.slug === this.selected() ? topSectors(this.detail()?.opportunities ?? []) : []));

  constructor() {
    // The wards of the chosen sector.
    toObservable(this.type)
      .pipe(
        switchMap((type) => {
          this.error.set(false);
          return this.api.wards(type, 'now', 'vi').pipe(
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
    toObservable(this.selected)
      .pipe(
        switchMap((slug) => (slug ? this.api.ward(slug, 'now', 'vi').pipe(catchError(() => of(null))) : of(null))),
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
