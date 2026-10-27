import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteLangService } from '../../services/site-lang.service';
import { ScoreGuideComponent } from './score-guide.component';
import { GUIDE_TEXT } from './score-guide.i18n';

describe('ScoreGuideComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ScoreGuideComponent>>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScoreGuideComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ScoreGuideComponent);
    fixture.detectChanges();
  });

  it('explains the three scores, with a link to each tool', () => {
    expect(el().querySelector('h1')!.textContent).toBe('Điểm số nghĩa là gì?');
    expect(el().querySelectorAll('.sg__sec h2').length).toBe(3);
    const links = Array.from(el().querySelectorAll<HTMLAnchorElement>('.sg__go')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/opportunity-map', '/living-score', '/property-intelligence']);
  });

  it('states the formula the server uses', () => {
    expect(el().textContent).toContain('Cơ hội = nhu cầu − 0,4 × cạnh tranh');
  });

  it('speaks English when the site does', () => {
    TestBed.inject(SiteLangService).set('en');
    fixture.detectChanges();
    expect(el().querySelector('h1')!.textContent).toBe('What do the scores mean?');
    expect(el().textContent).toContain('Opportunity = demand − 0.4 × competition');
  });

  it('has the same sections and terms in both languages', () => {
    const shape = (l: 'vi' | 'en') => GUIDE_TEXT[l].sections.map((s) => [s.id, s.terms.length, Boolean(s.example), s.link?.path]);
    expect(shape('en')).toEqual(shape('vi'));
    expect(GUIDE_TEXT.en.reading.length).toBe(GUIDE_TEXT.vi.reading.length);
  });
});
