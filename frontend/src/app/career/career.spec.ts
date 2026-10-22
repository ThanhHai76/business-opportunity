import { AREAS, AREAS_OF, CHANNELS, CONTEXT, DIRECTIONS, POLICIES, SIGNALS, SOURCES } from './career.data';
import { EMPTY_PROFILE, Profile, isComplete, rankDirections } from './career.logic';

const profile = (p: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, situation: 'unemployed', backgrounds: ['other'], education: 1, time: 1, work: 'either', ...p });

describe('Career compass: ranking', () => {
  it('ranks the same way for someone in work who only wants to see the market', () => {
    const ranked = rankDirections(profile({ situation: 'employed', backgrounds: ['logistics'], education: 1, time: 1, work: 'employee' }));
    expect(ranked.length).toBe(DIRECTIONS.length);
    expect(ranked[0].direction.id).toBe('logistics');
  });

  it('ranks nothing until every question is answered', () => {
    expect(isComplete(EMPTY_PROFILE)).toBeFalse();
    expect(rankDirections(EMPTY_PROFILE)).toEqual([]);
    expect(rankDirections({ ...profile({}), time: null })).toEqual([]);
  });

  it('puts high-tech first for a technical graduate with a year to train', () => {
    const ranked = rankDirections(profile({ situation: 'graduate', backgrounds: ['tech'], education: 2, time: 2, work: 'employee' }));
    expect(ranked[0].direction.id).toBe('semiconductor');
    expect(ranked[0].level).toBe('high');
  });

  it('puts what can start now first for someone in sales with no time to train, and warns about the long paths', () => {
    const ranked = rankDirections(profile({ backgrounds: ['sales'], education: 0, time: 0, work: 'employee' }));
    expect(ranked[0].direction.id).toBe('retail');
    const semi = ranked.find((r) => r.direction.id === 'semiconductor')!;
    expect(semi.score).toBeLessThan(ranked[0].score);
    expect(semi.cautions.length).toBeGreaterThan(0);
  });

  it('prefers self-employment for someone who wants it, and drops it for someone who wants to work for others', () => {
    const wantsSelf = rankDirections(profile({ backgrounds: ['service'], education: 0, time: 1, work: 'self' }));
    expect(wantsSelf[0].direction.id).toBe('self');
    const employee = rankDirections(profile({ backgrounds: ['service'], education: 0, time: 1, work: 'employee' }));
    const self = employee.find((r) => r.direction.id === 'self')!;
    expect(self.cautions.join(' ')).toContain('tự kinh doanh');
    expect(employee[0].direction.id).not.toBe('self');
  });

  it('scores between 0 and 100, best first, and counts the closest of several backgrounds', () => {
    const one = rankDirections(profile({ backgrounds: ['other'] }));
    const two = rankDirections(profile({ backgrounds: ['other', 'logistics'] }));
    for (const r of two) expect(r.score >= 0 && r.score <= 100).toBeTrue();
    expect(two.map((r) => r.score)).toEqual([...two.map((r) => r.score)].sort((a, b) => b - a));
    expect(two.find((r) => r.direction.id === 'logistics')!.score).toBeGreaterThan(one.find((r) => r.direction.id === 'logistics')!.score);
  });
});

describe('Career compass: data', () => {
  const ids = new Set(SOURCES.map((s) => s.id));
  const cited = [
    ...CONTEXT.flatMap((c) => c.sources),
    ...DIRECTIONS.flatMap((d) => d.facts.flatMap((f) => f.sources)),
    ...POLICIES.flatMap((p) => p.sources),
    ...CHANNELS.flatMap((c) => c.sources),
    ...Object.values(AREAS).flatMap((a) => a.sources),
    ...Object.values(SIGNALS).flatMap((s) => s.sources),
  ];

  it('cites only sources that are listed, and lists only sources that are cited', () => {
    expect(cited.filter((id) => !ids.has(id))).toEqual([]);
    expect([...ids].filter((id) => !cited.includes(id))).toEqual([]);
  });

  it('gives every direction one market signal, sourced except for self-employment', () => {
    for (const d of DIRECTIONS) {
      expect(SIGNALS[d.id]?.text.length).withContext(d.id).toBeGreaterThan(10);
      if (d.id !== 'self') expect(SIGNALS[d.id].sources.length).withContext(d.id).toBeGreaterThan(0);
    }
  });

  it('gives every direction its areas, and every area what it needs to show a distance', () => {
    for (const d of DIRECTIONS) expect(AREAS_OF[d.id]).withContext(d.id).toBeDefined();
    for (const [id, areas] of Object.entries(AREAS_OF)) for (const a of areas) expect(AREAS[a]).withContext(`${id}: ${a}`).toBeDefined();
    for (const a of Object.values(AREAS)) {
      expect(a.sources.length).withContext(a.id).toBeGreaterThan(0);
      if (a.kind === 'plan') expect(a.center?.length).withContext(a.id).toBe(2);
      else expect(['centre', 'offices', 'airport']).withContext(a.id).toContain(a.routed!);
    }
  });

  it('gives every sourced figure a source and every direction its steps', () => {
    for (const d of DIRECTIONS) {
      expect(d.steps.length).withContext(d.id).toBeGreaterThanOrEqual(3);
      expect(d.facts.length).withContext(d.id).toBeGreaterThan(0);
      if (d.id !== 'self') for (const f of d.facts) expect(f.sources.length).withContext(`${d.id}: ${f.text}`).toBeGreaterThan(0);
    }
    for (const s of SOURCES) expect(s.url.startsWith('https://')).withContext(s.id).toBeTrue();
  });
});
