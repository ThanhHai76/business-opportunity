import { AREAS, DIRECTIONS } from './career.data';
import { TravelItems, WardPoint, commuteText, commuteTo, lineKm, nearestWards, placementsFor } from './career.geo';
import { EMPTY_PROFILE, Profile } from './career.logic';
import { PHASES, buildPlan, dayOf, parsePlan, startPlan, toggleItem } from './career.plan';

const ward = (slug: string, center: [number, number]): WardPoint => ({ slug, name: `Phường ${slug}`, center });
const TAY_HO = ward('tay-ho', [105.82, 21.07]);
const THACH_THAT = ward('thach-that', [105.55, 21.03]);
const PHUC_LOI = ward('phuc-loi', [105.9, 21.07]);
const TRAVEL: TravelItems = {
  items: [
    { id: 'centre', name: 'Hồ Gươm', minutes: 13, km: 9.7 },
    { id: 'offices', name: 'Khu văn phòng', minutes: 23, km: 18.6 },
    { id: 'airport', name: 'Nội Bài', minutes: null, km: null },
  ],
};
const direction = (id: string) => DIRECTIONS.find((d) => d.id === id)!;
const profile = (p: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, situation: 'unemployed', backgrounds: ['other'], education: 1, time: 1, work: 'employee', ...p });

describe('Career compass: distances', () => {
  it('measures a straight line in kilometres', () => {
    // Hồ Gươm to the Hòa Lạc pole: about 34 km.
    const km = lineKm([105.8522, 21.0287], AREAS['hoa-lac'].center!);
    expect(km).toBeGreaterThan(33);
    expect(km).toBeLessThan(36);
    expect(lineKm([105.8, 21], [105.8, 21])).toBe(0);
  });

  it('uses the routed driving time for the reference places and a straight line for the planned poles', () => {
    expect(commuteTo(AREAS['centre'], TAY_HO, TRAVEL)).toEqual({ kind: 'drive', minutes: 13, km: 9.7 });
    expect(commuteTo(AREAS['hoa-lac'], TAY_HO, TRAVEL)?.kind).toBe('line');
    // No driving time known (no data, or the route is missing): nothing is invented.
    expect(commuteTo(AREAS['airport'], TAY_HO, TRAVEL)).toBeNull();
    expect(commuteTo(AREAS['centre'], TAY_HO, null)).toBeNull();
  });

  it('lists the wards nearest to a pole, closest first', () => {
    const near = nearestWards(AREAS['hoa-lac'], [TAY_HO, PHUC_LOI, THACH_THAT], 2);
    expect(near.map((n) => n.ward.slug)).toEqual(['thach-that', 'tay-ho']);
    expect(near[0].km).toBeLessThan(near[1].km);
    expect(nearestWards(AREAS['centre'], [TAY_HO])).toEqual([]);
  });

  it('shows the areas of a direction, with distances only once a ward is chosen', () => {
    const without = placementsFor('semiconductor', null, [TAY_HO, THACH_THAT], null);
    expect(without.map((p) => p.area.id)).toEqual(['hoa-lac', 'bac']);
    expect(without.every((p) => p.commute === null)).toBeTrue();
    expect(without[0].near.length).toBeGreaterThan(0);
    const withWard = placementsFor('semiconductor', TAY_HO, [TAY_HO, THACH_THAT], null);
    expect(withWard.every((p) => p.commute?.kind === 'line')).toBeTrue();
    expect(placementsFor('self', TAY_HO, [TAY_HO], TRAVEL)).toEqual([]);
  });

  it('writes the distance in words, saying what it is', () => {
    expect(commuteText({ kind: 'drive', minutes: 23, km: 18.6 })).toContain('23 phút lái xe');
    expect(commuteText({ kind: 'drive', minutes: 23, km: 18.6 })).toContain('chưa tính kẹt xe');
    expect(commuteText({ kind: 'line', km: 34.2 })).toContain('đường chim bay');
    expect(commuteText(null)).toBe('');
  });
});

describe('Career compass: the 30-day plan', () => {
  it('gives every direction a plan with unique steps in each phase, ending with a review', () => {
    for (const d of DIRECTIONS) {
      const items = buildPlan(profile({}), d);
      expect(new Set(items.map((i) => i.id)).size).withContext(d.id).toBe(items.length);
      for (const ph of PHASES) expect(items.some((i) => i.phase === ph.id)).withContext(`${d.id} ${ph.id}`).toBeTrue();
      expect(items.at(-1)?.id).toBe('review');
    }
  });

  it('differs for a graduate, adds warnings when time or education fall short, and has no more steps than needed', () => {
    const graduate = buildPlan(profile({ situation: 'graduate' }), direction('retail'));
    expect(graduate.find((i) => i.id === 'cv')?.text).toContain('học vấn');
    expect(graduate.find((i) => i.id === 'support')?.text).not.toContain('bảo hiểm thất nghiệp');
    const short = buildPlan(profile({ time: 0, education: 0 }), direction('semiconductor')).map((i) => i.id);
    expect(short).toContain('time');
    expect(short).toContain('edu');
    const fine = buildPlan(profile({ time: 2, education: 2 }), direction('semiconductor')).map((i) => i.id);
    expect(fine).not.toContain('time');
    expect(fine).not.toContain('edu');
  });

  it('keeps the job of someone already in work, and does not tell them to claim benefits', () => {
    const items = buildPlan(profile({ situation: 'employed' }), direction('finance'));
    const ids = items.map((i) => i.id);
    expect(ids).toContain('keep');
    expect(items.find((i) => i.id === 'cv')?.text).toContain('thành tích');
    expect(items.find((i) => i.id === 'support')?.text).toContain('Tìm hiểu trước');
    expect(items.find((i) => i.id === 'apply')?.text).toContain('Nếu quyết định đổi việc');
    expect(buildPlan(profile({ situation: 'unemployed' }), direction('finance')).map((i) => i.id)).not.toContain('keep');
  });

  it('tests a small business instead of applying for self-employment, and for those who want it in a mixed direction', () => {
    const self = buildPlan(profile({ work: 'employee' }), direction('self')).map((i) => i.id);
    expect(self).toContain('calc');
    expect(self).not.toContain('apply');
    expect(buildPlan(profile({ work: 'self' }), direction('tourism')).map((i) => i.id)).toContain('calc');
    expect(buildPlan(profile({ work: 'employee' }), direction('tourism')).map((i) => i.id)).toContain('apply');
  });

  it('ticks and unticks a step, and counts the days', () => {
    const start = new Date('2026-10-01T08:00:00Z');
    let plan = startPlan('retail', start);
    plan = toggleItem(plan, 'cv');
    expect(plan.done).toEqual(['cv']);
    plan = toggleItem(plan, 'cv');
    expect(plan.done).toEqual([]);
    expect(dayOf(plan, new Date('2026-10-01T20:00:00Z'))).toBe(1);
    expect(dayOf(plan, new Date('2026-10-30T20:00:00Z'))).toBe(30);
    expect(dayOf(plan, new Date('2026-11-05T08:00:00Z'))).toBeNull();
  });

  it('reads back only a real plan, dropping ticks of steps that no longer exist', () => {
    const items = (id: string) => buildPlan(profile({}), direction(id));
    expect(parsePlan(null)).toBeNull();
    expect(parsePlan({ directionId: 'khong-co', startedAt: '2026-10-01T00:00:00Z', done: [] })).toBeNull();
    expect(parsePlan({ directionId: 'retail', startedAt: 'hôm qua', done: [] })).toBeNull();
    const ok = parsePlan({ directionId: 'retail', startedAt: '2026-10-01T00:00:00Z', done: ['cv', 'cu-khong-con', 7] }, items);
    expect(ok?.done).toEqual(['cv']);
  });
});
