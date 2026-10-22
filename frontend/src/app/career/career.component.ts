import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { PiApiService } from '../property-intel/pi.service';
import { CHANNELS, CONTEXT, DATA_DATE, DIRECTIONS, POLICIES, SIGNALS, SOURCES, Background } from './career.data';
import { TravelItems, WardPoint, commuteText, placementsFor } from './career.geo';
import { JobMapSectionComponent } from './job-map-section.component';
import { CareerStore, MAX_PLANS } from './career.store';
import { OpBrandComponent } from '../opportunity/op-brand.component';
import { OP_TEXT } from '../opportunity/op-i18n';
import { planPrintHtml } from './career.print';
import { PHASES, afterThirtyDays, buildPlan, dayOf } from './career.plan';
import { BillingService } from '../services/billing.service';
import { PremiumPromptService } from '../services/premium-prompt.service';
import { EDUCATIONS, SITUATIONS, TIMES, WORKS } from './career.labels';
import { BACKGROUND_LABEL, EMPTY_PROFILE, Level, Profile, WEIGHTS, isComplete, rankDirections } from './career.logic';

const SHOWN = 5;

type TabId = 'paths' | 'plan' | 'market' | 'map' | 'support';
const TABS: { id: TabId; label: string }[] = [
  { id: 'paths', label: 'Hướng nghề của bạn' },
  { id: 'plan', label: 'Kế hoạch 30 ngày' },
  { id: 'market', label: 'Thị trường' },
  { id: 'map', label: 'Bản đồ' },
  { id: 'support', label: 'Hỗ trợ và nơi tìm việc' },
];

/** The tab in the address (?tab=map), so a link can open the page on it. */
function initialTab(): TabId {
  try {
    const t = new URLSearchParams(location.search).get('tab');
    return TABS.some((x) => x.id === t) ? (t as TabId) : 'paths';
  } catch {
    return 'paths';
  }
}

const LEVEL_LABEL: Record<Level, string> = { high: 'Phù hợp cao', medium: 'Phù hợp vừa', low: 'Ít phù hợp' };

/**
 * La bàn nghề nghiệp Hà Nội — five short questions, then the career directions that fit, each with what the sources
 * say about Hà Nội, the skills and first steps. Not a job board: it points to the official job channels and to the
 * support the Employment Law gives. The ranking is rule-based and explained (career.logic.ts); every figure is cited.
 */
@Component({
  selector: 'app-career',
  standalone: true,
  imports: [RouterLink, JobMapSectionComponent, OpBrandComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="cc">
      <header class="cc__hero">
        <p class="cc__eyebrow">Việc làm · Định hướng nghề nghiệp</p>
        <h1>La bàn nghề nghiệp Hà Nội</h1>
        <p class="cc__lead">
          Dành cho người đang thất nghiệp, muốn đổi nghề, mới ra trường, và cả người đang đi làm muốn tham khảo thị trường việc làm.
          Trả lời 5 câu hỏi ngắn để thấy những hướng nghề hợp với bạn, gắn với cách Hà Nội đang thay đổi. Mỗi con số đều có nguồn.
        </p>
      </header>

      <nav class="cc__tabs" role="tablist" aria-label="Các phần của trang">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            [id]="'cc-tab-' + t.id"
            [attr.aria-selected]="tab() === t.id"
            [attr.aria-controls]="'cc-panel-' + t.id"
            [attr.tabindex]="tab() === t.id ? 0 : -1"
            (click)="openTab(t.id)"
            (keydown)="onTabKey($event)"
          >
            {{ t.label }}
            @if (t.id === 'plan' && planView(); as pv) {
              <span class="cc__tabbadge">{{ pv.done }}/{{ pv.total }}</span>
            }
          </button>
        }
      </nav>


      <!-- Your directions: the questions, then what fits -->
      @if (tab() === 'paths') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-paths" aria-labelledby="cc-tab-paths" tabindex="0">
          <section class="cc__form" aria-labelledby="cc-form">
            <h2 id="cc-form">Về bạn</h2>

            <fieldset>
              <legend>1. Bạn đang ở hoàn cảnh nào?</legend>
              <div class="cc__chips">
                @for (o of situations; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().situation === o.value" (click)="set('situation', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>2. Nghề hiện tại, nghề cũ hoặc ngành đã học của bạn? <small>Chọn một hoặc nhiều</small></legend>
              <div class="cc__chips">
                @for (b of backgrounds; track b.value) {
                  <button type="button" [attr.aria-pressed]="profile().backgrounds.includes(b.value)" (click)="toggleBackground(b.value)">{{ b.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>3. Trình độ cao nhất của bạn?</legend>
              <div class="cc__chips">
                @for (o of educations; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().education === o.value" (click)="set('education', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>4. Bạn có bao lâu để học thêm trước khi bắt đầu việc mới?</legend>
              <div class="cc__chips">
                @for (o of times; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().time === o.value" (click)="set('time', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>5. Bạn muốn làm thuê hay tự kinh doanh?</legend>
              <div class="cc__chips">
                @for (o of works; track o.value) {
                  <button type="button" [attr.aria-pressed]="profile().work === o.value" (click)="set('work', o.value)">{{ o.label }}</button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend>6. Bạn đang ở phường/xã nào? <small>Không bắt buộc: để xem khoảng cách tới nơi làm việc</small></legend>
              <select class="cc__select" aria-label="Phường hoặc xã bạn đang ở" [value]="profile().ward ?? ''" (change)="setWard($any($event.target).value)">
                <option value="">Chưa chọn</option>
                @for (w of wards(); track w.slug) {
                  <option [value]="w.slug" [selected]="w.slug === profile().ward">{{ w.name }}</option>
                }
              </select>
            </fieldset>

            <div class="cc__formfoot">
              @if (complete()) {
                <button type="button" class="cc__go" (click)="goToResults()">Xem hướng nghề của bạn ↓</button>
              } @else {
                <span class="cc__hint">Trả lời đủ 5 câu để xem kết quả. Câu trả lời chỉ lưu trên trình duyệt này.</span>
              }
              <button type="button" class="cc__link" (click)="reset()">Làm lại</button>
            </div>
          </section>

          @if (complete()) {
            <section class="cc__results" id="cc-results" aria-labelledby="cc-results-title" tabindex="-1">
              <h2 id="cc-results-title">Hướng nghề gợi ý cho bạn</h2>
              <p class="cc__note">
                Xếp theo mức phù hợp với câu trả lời của bạn. Đây là gợi ý để bạn tìm hiểu thêm, không phải lời hứa có việc làm.
                @if (profile().situation === 'employed') {
                  Bạn không cần đổi việc: hãy dùng kết quả để so sánh nghề hiện tại với các hướng khác và với thị trường.
                }
                <button type="button" class="cc__link" (click)="goToMap()">Xem bản đồ ngành nghề theo khu vực ↓</button>
              </p>
              <ol class="cc__list">
                @for (r of shown(); track r.direction.id; let i = $index) {
                  <li class="cc__card" [class.is-low]="r.level === 'low'">
                    <div class="cc__cardhead">
                      <span class="cc__icon" aria-hidden="true">{{ r.direction.icon }}</span>
                      <div>
                        <h3>{{ r.direction.name }}</h3>
                        <p>{{ r.direction.blurb }}</p>
                      </div>
                      <span class="cc__badge" [attr.data-level]="r.level">{{ levelLabel[r.level] }} · {{ r.score }}</span>
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
                      <summary>Hà Nội đang thay đổi thế nào, kỹ năng và bước đầu tiên</summary>
                      <h4>Hà Nội</h4>
                      <ul class="cc__facts">
                        @for (f of r.direction.facts; track f.text) {
                          <li>{{ f.text }} @for (s of cites(f.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</li>
                        }
                      </ul>
                      <div class="cc__two">
                        <div>
                          <h4>Vị trí thường gặp</h4>
                          <ul>
                            @for (x of r.direction.roles; track x) {
                              <li>{{ x }}</li>
                            }
                          </ul>
                        </div>
                        <div>
                          <h4>Kỹ năng cần có</h4>
                          <ul>
                            @for (x of r.direction.skills; track x) {
                              <li>{{ x }}</li>
                            }
                          </ul>
                        </div>
                      </div>
                      <h4>Gợi ý lộ trình</h4>
                      <ol class="cc__steps">
                        @for (s of r.direction.steps; track s.when) {
                          <li><b>{{ s.when }}</b> {{ s.text }}</li>
                        }
                      </ol>
                      @if (placementsOf(r.direction.id); as places) {
                        @if (places.length) {
                          <h4>Nơi làm việc và nơi ở</h4>
                          <ul class="cc__places">
                            @for (pl of places; track pl.area.id) {
                              <li>
                                <div class="cc__areahead">
                                  <b>{{ pl.area.name }}</b>
                                  <span class="cc__tag" [attr.data-kind]="pl.area.kind">{{ pl.area.kind === 'plan' ? 'Theo quy hoạch' : 'Điểm mốc' }}</span>
                                </div>
                                <p>{{ pl.area.note }} @for (s of cites(pl.area.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</p>
                                @if (pl.commute) {
                                  <p class="cc__commute">Từ {{ wardName() }}: {{ commuteText(pl.commute) }}.</p>
                                }
                                @if (pl.near.length) {
                                  <p class="cc__near">
                                    Phường/xã gần nhất trong 79 nơi có dữ liệu:
                                    @for (n of pl.near; track n.ward.slug; let last = $last) {
                                      <a [routerLink]="'/property-intelligence/map'" [queryParams]="{ ward: n.ward.slug }">{{ n.ward.name }}</a> ({{ km(n.km) }} km){{ last ? '' : ', ' }}
                                    }
                                  </p>
                                }
                              </li>
                            }
                          </ul>
                          <p class="cc__note">
                            @if (!profile().ward) {
                              Chọn phường/xã bạn ở (câu 6) để xem khoảng cách.
                            }
                            Cực theo quy hoạch là hướng phát triển, chưa phải nơi đã có sẵn việc làm, và danh sách phường/xã chỉ gồm 79 nơi mà Chấm điểm bất động sản có dữ liệu (chưa phủ hết các xã xa trung tâm). Thời gian lái xe tính bằng ô tô, đường thông thoáng, giờ cao điểm lâu hơn nhiều.
                          </p>
                        }
                      }
                      <p class="cc__tools">
                        @for (t of r.direction.tools; track t.path) {
                          <a [routerLink]="t.path">{{ t.label }} →</a>
                        }
                      </p>
                    </details>
                    <button type="button" class="cc__planbtn" [class.is-on]="hasPlan(r.direction.id)" (click)="choosePlan(r.direction.id)">{{ planLabel(r.direction.id) }}</button>
                  </li>
                }
              </ol>
              @if (ranked().length > shownCount) {
                <button type="button" class="cc__more" (click)="showAll.set(!showAll())">{{ showAll() ? 'Chỉ xem ' + shownCount + ' hướng đầu' : 'Xem thêm ' + (ranked().length - shownCount) + ' hướng khác' }}</button>
              }
              <details class="cc__how">
                <summary>Cách tính điểm phù hợp</summary>
                <p>
                  Điểm tối đa 100: nền tảng gần với hướng nghề ({{ weights.background }}), thời gian học thêm đủ chưa ({{ weights.training }}),
                  trình độ thường được hỏi ({{ weights.education }}), và hợp với việc làm thuê hay tự kinh doanh bạn chọn ({{ weights.work }}).
                  Điểm không tính đến lương hay số tin tuyển, vì chưa có số liệu đủ tin cậy cho từng vị trí.
                </p>
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
            <div class="cc__plans" role="group" aria-label="Kế hoạch đã lưu">
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
            <button type="button" class="cc__premiumnote" (click)="askPremium('Lưu kế hoạch vào tài khoản')">
              <span aria-hidden="true">★</span> Lưu kế hoạch vào tài khoản, mở trên mọi thiết bị và giữ tới {{ maxPlans }} kế hoạch cùng lúc (Premium)
            </button>
          }
          @if (planView(); as pv) {
            <section class="cc__plan" id="cc-plan" tabindex="-1" aria-labelledby="cc-plan-title">
              <div class="cc__planhead">
                <div>
                  <h2 id="cc-plan-title">Kế hoạch 30 ngày: {{ pv.direction.name }}</h2>
                  <p>Bắt đầu {{ pv.started }} · {{ pv.dayText }}</p>
                </div>
                <div class="cc__progress">
                  <b>{{ pv.done }}/{{ pv.total }} việc</b>
                  <progress [value]="pv.done" [max]="pv.total" aria-label="Tiến độ kế hoạch"></progress>
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
              <p class="cc__after"><b>Sau 30 ngày:</b> {{ pv.after }}</p>
          <div class="cc__export">
            <button type="button" class="cc__go" (click)="exportPdf()">
              <span aria-hidden="true">⬇</span> Xuất PDF kế hoạch @if (locked()) { <span class="cc__star" aria-hidden="true">★</span> }
            </button>
            <span class="cc__hint">Mở trang in của trình duyệt: chọn "Lưu dưới dạng PDF".</span>
            @if (exportMessage(); as em) {
              <span class="cc__hint" role="status">{{ em }}</span>
            }
          </div>
          <app-op-brand [t]="brandText" [lang]="'vi'" [teaser]="brandTeaser" [hint]="brandHint" />
              <p class="cc__note">Đây là gợi ý để bạn tự theo dõi, lưu trên trình duyệt này.</p>
              <button type="button" class="cc__link" (click)="clearPlan()">Xoá kế hoạch</button>
            </section>
          } @else {
      <section class="cc__plan cc__plan--empty" id="cc-plan" aria-labelledby="cc-plan-title">
        <h2 id="cc-plan-title">Kế hoạch 30 ngày</h2>
        <p>Bạn chưa có kế hoạch. Chọn một hướng nghề rồi bấm "Lập kế hoạch 30 ngày cho hướng này": bạn sẽ có danh sách việc theo từng tuần để tick khi làm xong.</p>
        <button type="button" class="cc__go" (click)="openTab('paths')">Xem hướng nghề của bạn</button>
      </section>
          }
        </div>
      }

      <!-- The market -->
      @if (tab() === 'market') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-market" aria-labelledby="cc-tab-market" tabindex="0">
          <section class="cc__context" aria-labelledby="cc-context">
            <h2 id="cc-context">Bức tranh chung</h2>
            <div class="cc__stats">
              @for (c of context; track c.label) {
                <div class="cc__stat">
                  <b>{{ c.value }}</b>
                  <span>{{ c.label }} @for (s of cites(c.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</span>
                </div>
              }
            </div>
            <p class="cc__note">Chưa tìm thấy số liệu thất nghiệp riêng của Hà Nội: đây là số liệu cả nước.</p>

            <h3 class="cc__subhead">Thị trường theo hướng nghề</h3>
            <p class="cc__note">Mỗi hướng nghề một dòng tín hiệu từ nguồn công khai, để bạn so sánh. Đây không phải mức lương hay số vị trí đang tuyển.</p>
            <div class="cc__scroll">
              <table class="cc__market">
                <thead>
                  <tr>
                    <th scope="col">Hướng nghề</th>
                    <th scope="col">Tín hiệu từ nguồn công khai</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of market(); track m.direction.id) {
                    <tr [class.is-yours]="m.yours">
                      <th scope="row">{{ m.direction.icon }} {{ m.direction.name }} @if (m.yours) { <span class="cc__yours">gần nghề của bạn</span> }</th>
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
            <app-job-map-section [home]="profile().ward" (homeChange)="setWard($event)" />
          } @placeholder {
            <div class="cc__mapph">Đang tải bản đồ…</div>
          }
        }
      </div>

      <!-- Support and where to look for work -->
      @if (tab() === 'support') {
        <div class="cc__panel" role="tabpanel" id="cc-panel-support" aria-labelledby="cc-tab-support" tabindex="0">
          <section class="cc__support" aria-labelledby="cc-support">
            <h2 id="cc-support">Hỗ trợ và nơi tìm việc chính thống</h2>
            <div class="cc__grid">
              <div>
                <h3>Chính sách cho người thất nghiệp</h3>
                <dl class="cc__policies">
                  @for (p of policies; track p.title) {
                    <dt>{{ p.title }}</dt>
                    <dd>{{ p.text }} @for (s of cites(p.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</dd>
                  }
                </dl>
                <p class="cc__note">Tóm tắt từ Luật Việc làm 2025 (có hiệu lực từ 1/1/2026). Mức hưởng, điều kiện và thủ tục thay đổi: hãy hỏi trung tâm dịch vụ việc làm hoặc cơ quan bảo hiểm xã hội trước khi quyết định.</p>
              </div>
              <div>
                <h3>Nơi tìm việc</h3>
                <ul class="cc__channels">
                  @for (c of channels; track c.url) {
                    <li>
                      <a [href]="c.url" target="_blank" rel="noopener noreferrer">{{ c.name }} ↗</a>
                      <span>{{ c.text }} @for (s of cites(c.sources); track s.id) { <a class="cc__cite" [href]="s.url" target="_blank" rel="noopener noreferrer" [title]="s.title">[{{ s.n }}]</a> }</span>
                    </li>
                  }
                </ul>
                <p class="cc__note">Trang này không đăng tin tuyển dụng. Hãy dùng các kênh chính thống và cảnh giác với lời mời việc làm đòi tiền đặt cọc.</p>
              </div>
            </div>
          </section>
        </div>
      }

      <section class="cc__sources" aria-labelledby="cc-sources">
        <h2 id="cc-sources">Nguồn</h2>
        <ol>
          @for (s of sources; track s.id) {
            <li>
              <a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.title }}</a> — {{ s.publisher }}
              <small>({{ s.kind === 'official' ? 'văn bản, số liệu chính thức' : s.kind === 'computed' ? 'số liệu tính từ dữ liệu mở' : 'báo chí đưa tin' }})</small>
            </li>
          }
        </ol>
        <p class="cc__note">
          Dữ liệu tổng hợp ngày {{ dataDate }} từ nguồn công khai. Phần lớn là báo chí dẫn lại số liệu và kế hoạch của cơ quan nhà nước, chưa phải văn bản gốc:
          hãy đối chiếu trước khi dùng cho quyết định quan trọng. Đây là công cụ tham khảo, không đảm bảo việc làm hay thu nhập.
        </p>
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100%; background: var(--app-bg); color: var(--app-ink); font-family: 'Manrope', -apple-system, 'Segoe UI', sans-serif; line-height: 1.55; }
    .cc { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; display: grid; gap: 28px; }
    .cc__hero h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 560; font-size: clamp(28px, 5vw, 44px); line-height: 1.12; margin: 4px 0 10px; }
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
    .cc__tabs { display: flex; gap: 6px; overflow-x: auto; position: sticky; top: var(--site-nav-h, 56px); z-index: 5; padding: 8px 0; background: var(--app-bg); border-bottom: 1px solid var(--app-line); scrollbar-width: thin; }
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
    @media (max-width: 560px) { .cc__cardhead { grid-template-columns: auto 1fr; } .cc__badge { grid-column: 1 / -1; justify-self: start; } }
  `,
})
export class CareerComponent {
  protected readonly context = CONTEXT;
  protected readonly policies = POLICIES;
  protected readonly channels = CHANNELS;
  protected readonly sources = SOURCES;
  protected readonly dataDate = DATA_DATE;
  protected readonly weights = WEIGHTS;
  protected readonly levelLabel = LEVEL_LABEL;
  protected readonly shownCount = SHOWN;
  protected readonly situations = SITUATIONS;
  protected readonly educations = EDUCATIONS;
  protected readonly times = TIMES;
  protected readonly works = WORKS;
  protected readonly backgrounds = (Object.keys(BACKGROUND_LABEL) as Background[]).map((value) => ({ value, label: BACKGROUND_LABEL[value] }));

  private readonly api = inject(PiApiService);
  protected readonly tabs = TABS;
  protected readonly tab = signal<TabId>(initialTab());
  /** The map is created when its tab is first opened and then kept, so what you chose on it stays. */
  protected readonly mapSeen = signal(initialTab() === 'map');
  private readonly store = inject(CareerStore);
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
  private readonly placements = computed(() => new Map(DIRECTIONS.map((d) => [d.id, placementsFor(d.id, this.currentWard(), this.wards(), this.travel())])));

  protected readonly planView = computed(() => {
    const plan = this.plan();
    const direction = plan ? DIRECTIONS.find((d) => d.id === plan.directionId) : null;
    if (!plan || !direction) return null;
    const items = buildPlan(this.profile(), direction);
    const doneIds = new Set(plan.done);
    const day = dayOf(plan);
    return {
      direction,
      started: new Date(plan.startedAt).toLocaleDateString('vi-VN'),
      dayText: day ? `ngày thứ ${day}/30` : 'đã qua 30 ngày: xem lại và chỉnh kế hoạch nếu cần',
      done: items.filter((i) => doneIds.has(i.id)).length,
      total: items.length,
      doneIds,
      phases: PHASES.map((p) => ({ ...p, items: items.filter((i) => i.phase === p.id) })),
      after: afterThirtyDays(direction),
    };
  });
  /** One chip per plan kept, with its progress. */
  protected readonly planChips = computed(() =>
    this.store.plans().map((p) => {
      const direction = DIRECTIONS.find((d) => d.id === p.directionId)!;
      const items = buildPlan(this.profile(), direction);
      return { id: p.directionId, name: direction.name, icon: direction.icon, done: items.filter((i) => p.done.includes(i.id)).length, total: items.length };
    }),
  );
  /** What the account is doing with the plans, for people whose plans are kept there. */
  protected readonly syncNote = computed(() => {
    if (!this.store.inAccount()) return null;
    if (this.store.syncing()) return 'Đang đồng bộ với tài khoản…';
    return this.store.syncError() ?? '✓ Đã lưu vào tài khoản của bạn: mở được trên mọi thiết bị.';
  });
  protected readonly maxPlans = MAX_PLANS;
  protected readonly brandText = OP_TEXT.vi.premium;
  protected readonly brandTeaser = 'In kế hoạch mang tên và liên hệ của bạn (dành cho tư vấn viên, giáo viên hướng nghiệp, trung tâm đào tạo)';
  protected readonly brandHint = 'Bản PDF kế hoạch nghề nghiệp sẽ mang tên công ty, tên và liên hệ của bạn thay cho tên trang web, để bạn gửi học viên hoặc khách hàng.';
  protected readonly exportMessage = signal<string | null>(null);
  protected readonly showAll = signal(false);
  protected readonly complete = computed(() => isComplete(this.profile()));
  /** One market signal per direction, with those close to the visitor's own field marked. */
  protected readonly market = computed(() =>
    DIRECTIONS.map((direction) => ({ direction, signal: SIGNALS[direction.id], yours: this.profile().backgrounds.some((b) => direction.fit[b] === 3) })),
  );
  protected readonly ranked = computed(() => rankDirections(this.profile()));
  protected readonly shown = computed(() => (this.showAll() ? this.ranked() : this.ranked().slice(0, SHOWN)));

  /** The sources of a figure, with their number in the list at the end of the page. */
  protected cites(ids: string[]): { id: string; n: number; url: string; title: string }[] {
    return ids.map((id) => {
      const i = SOURCES.findIndex((s) => s.id === id);
      return { id, n: i + 1, url: SOURCES[i]?.url ?? '', title: SOURCES[i]?.title ?? '' };
    });
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
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  }

  /** Starts the 30-day plan of a direction and shows it. Without Premium one plan is kept: another needs Premium. */
  protected choosePlan(directionId: string): void {
    this.planMessage.set(null);
    const result = this.store.start(directionId);
    if (result === 'limit') {
      if (this.locked()) this.askPremium('Giữ nhiều kế hoạch cùng lúc');
      else {
        this.planMessage.set(`Bạn đang giữ ${MAX_PLANS} kế hoạch, là mức tối đa: hãy xoá bớt một kế hoạch rồi lập kế hoạch mới.`);
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
    if (this.hasPlan(directionId)) return '✓ Đang theo kế hoạch này';
    return this.locked() && this.planChips().length >= 1 ? '★ Lập thêm kế hoạch (Premium)' : 'Lập kế hoạch 30 ngày cho hướng này';
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
    if (this.locked()) return this.askPremium('Xuất PDF kế hoạch nghề nghiệp');
    const view = this.planView();
    const plan = this.plan();
    if (!view || !plan) return;
    this.exportMessage.set(null);
    const direction = view.direction;
    const html = planPrintHtml({
      direction,
      items: buildPlan(this.profile(), direction),
      done: view.doneIds,
      profile: this.profile(),
      ranked: this.ranked().find((r) => r.direction.id === direction.id) ?? null,
      places: this.placementsOf(direction.id).map((p) => ({
        name: p.area.name,
        kind: p.area.kind,
        note: p.area.note,
        commute: commuteText(p.commute),
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
    if (!tab) this.exportMessage.set('Trình duyệt đã chặn tab mới: hãy cho phép cửa sổ bật lên rồi thử lại.');
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }

  protected askPremium(feature: string): void {
    this.premiumPrompt.open(feature, 'vi');
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
