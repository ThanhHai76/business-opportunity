import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OpRoadmapComponent } from './op-roadmap.component';
import { OP_TEXT } from './op-i18n';

describe('OpRoadmapComponent', () => {
  let fixture: ComponentFixture<OpRoadmapComponent>;
  const mount = (locked: boolean) => {
    fixture = TestBed.createComponent(OpRoadmapComponent);
    fixture.componentRef.setInput('type', 'cafe');
    fixture.componentRef.setInput('typeName', 'Quán cà phê');
    fixture.componentRef.setInput('wardSlug', 'phuong-test');
    fixture.componentRef.setInput('wardName', 'Phường Test');
    fixture.componentRef.setInput('text', OP_TEXT.vi);
    fixture.componentRef.setInput('locked', locked);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => localStorage.removeItem('hcv.roadmap.cafe.phuong-test'));

  it('without Premium: the seven steps and an unlock button, no costs', () => {
    const el = mount(true);
    expect(el.querySelectorAll('.rm__steps li').length).toBe(7);
    expect(el.querySelector('.rm__lock')).toBeTruthy();
    expect(el.querySelector('.rm__pro')).toBeNull();
    let asked = 0;
    fixture.componentInstance.upgrade.subscribe(() => asked++);
    (el.querySelector('.rm__btn--pro') as HTMLButtonElement).click();
    expect(asked).toBe(1);
  });

  it('with Premium: dates, costs, the cash needed, and progress that is saved', () => {
    const el = mount(false);
    expect(el.querySelector('.rm__lock')).toBeNull();
    expect(el.querySelector('.rm__stats')?.textContent).toContain('tr');
    (el.querySelector('.rm__tick input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(JSON.parse(localStorage.getItem('hcv.roadmap.cafe.phuong-test')!).done).toEqual(['lease']);
    fixture.destroy();
    const again = mount(false);
    fixture.detectChanges();
    expect((again.querySelector('.rm__tick input') as HTMLInputElement).checked).toBeTrue();
  });
});
