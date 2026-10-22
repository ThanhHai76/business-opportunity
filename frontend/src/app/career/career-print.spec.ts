import { DIRECTIONS, SOURCES } from './career.data';
import { EMPTY_PROFILE, Profile, hasAnswers, parseProfile, rankDirections } from './career.logic';
import { buildPlan, knownItemIds, parsePlans, startPlan } from './career.plan';
import { PrintInput, planPrintHtml } from './career.print';

const profile: Profile = { ...EMPTY_PROFILE, situation: 'unemployed', backgrounds: ['logistics'], education: 1, time: 1, work: 'employee', ward: 'phuong-tay-ho' };
const direction = DIRECTIONS.find((d) => d.id === 'logistics')!;

function input(extra: Partial<PrintInput> = {}): PrintInput {
  const items = buildPlan(profile, direction);
  return {
    direction,
    items,
    done: new Set(['cv', 'accounts']),
    profile,
    ranked: rankDirections(profile).find((r) => r.direction.id === direction.id) ?? null,
    places: [
      { name: 'Sân bay Nội Bài', kind: 'now', note: 'Điểm mốc dùng để tính thời gian đi lại.', commute: 'khoảng 22 phút lái xe (21,5 km, chưa tính kẹt xe)', near: '', sources: ['osrm'] },
      { name: 'Cực phía Bắc', kind: 'plan', note: 'Quy hoạch: logistics.', commute: 'khoảng 13,9 km theo đường chim bay', near: 'Xã Phúc Thịnh (1,7 km)', sources: ['qd2512-poles'] },
    ],
    wardName: 'Phường Tây Hồ',
    startedAt: '2026-10-21T08:00:00.000Z',
    generatedAt: new Date('2026-10-25T08:00:00.000Z'),
    brand: null,
    ...extra,
  };
}

describe('Career compass: the printed plan', () => {
  it('prints the plan with what was answered, the steps by phase with their ticks, the places and the sources', () => {
    const html = planPrintHtml(input());
    expect(html).toContain('Kế hoạch nghề nghiệp: Vận tải và logistics');
    expect(html).toContain('Hanoi Century Vista · La bàn nghề nghiệp Hà Nội');
    expect(html).toContain('Đang thất nghiệp');
    expect(html).toContain('kho, vận tải, giao nhận');
    expect(html).toContain('Phường Tây Hồ');
    expect(html).toContain('Tuần 1 · Chuẩn bị');
    expect(html).toContain('Tuần 3–4 · Hành động');
    expect(html).toContain('Sân bay Nội Bài');
    expect(html).toContain('22 phút lái xe');
    expect(html).toContain('Xã Phúc Thịnh (1,7 km)');
    expect((html.match(/☑/g) ?? []).length).toBe(2);
    expect(html).toContain('Đã làm 2/');
    expect(html).toContain('OpenStreetMap');
  });

  it('numbers the sources as the page does, and lists those cited and no others', () => {
    const html = planPrintHtml(input());
    const n = (id: string) => SOURCES.findIndex((s) => s.id === id) + 1;
    expect(html).toContain(`<sup>[${n('dbnd-tuyen-dung')}]</sup>`);
    expect(html).toContain(`<li value="${n('osrm')}">`);
    expect(html).toContain(`<li value="${n('luat-viec-lam')}">`);
    expect(html).not.toContain(`<li value="${n('baodautu-bandan')}">`); // not cited by this plan
  });

  it('puts the details of the person who prepares it in place of the site, and escapes everything', () => {
    const html = planPrintHtml(input({ brand: { company: 'Trung tâm <Đào tạo> A', name: 'Lan Anh', phone: '0900 000 111', email: 'lan@a.vn', note: 'Chúc bạn "thành công" & vững bước' } }));
    expect(html).toContain('Trung tâm &lt;Đào tạo&gt; A · Kế hoạch nghề nghiệp');
    expect(html).toContain('Chuẩn bị bởi: Lan Anh · 0900 000 111 · lan@a.vn');
    expect(html).toContain('Chúc bạn &quot;thành công&quot; &amp; vững bước');
    expect(html).not.toContain('Hanoi Century Vista · La bàn nghề nghiệp Hà Nội');
    expect(html).toContain('Số liệu phân tích: Hanoi Century Vista');
    expect(html).not.toContain('<Đào tạo>');
  });

  it('leaves out the places when there are none, and says when the questions were not all answered', () => {
    const html = planPrintHtml(input({ places: [], ranked: null, wardName: '', profile: { ...profile, ward: null, time: null } }));
    expect(html).not.toContain('Nơi làm việc và khoảng cách');
    expect(html).toContain('Chưa trả lời đủ câu hỏi');
    expect(html).toContain('chưa trả lời');
    expect(html).toContain('<h2>4. Kế hoạch 30 ngày</h2>');
  });
});

describe('Career compass: reading what is stored', () => {
  it('keeps only valid answers', () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE);
    const p = parseProfile({ situation: 'employed', backgrounds: ['tech', 'khong-co', 7], education: 2, time: 9, work: 'self', ward: 'phuong-tay-ho' });
    expect(p).toEqual({ situation: 'employed', backgrounds: ['tech'], education: 2, time: null, work: 'self', ward: 'phuong-tay-ho' });
    expect(parseProfile({ ward: 'Bad Slug' }).ward).toBeNull();
    expect(hasAnswers(EMPTY_PROFILE)).toBeFalse();
    expect(hasAnswers({ ...EMPTY_PROFILE, ward: 'a' })).toBeTrue();
  });

  it('keeps one plan per direction (the newest), newest first, and drops what is not a plan', () => {
    const old = { ...startPlan('retail', new Date('2026-10-01T00:00:00Z')), done: ['cv'] };
    const fresh = { ...startPlan('retail', new Date('2026-10-09T00:00:00Z')), done: ['cv', 'accounts'] };
    const other = startPlan('finance', new Date('2026-10-05T00:00:00Z'));
    const plans = parsePlans([old, fresh, other, { directionId: 'khong-co' }, 'x', null]);
    expect(plans.map((p) => p.directionId)).toEqual(['retail', 'finance']);
    expect(plans[0].done).toEqual(['cv', 'accounts']);
    expect(parsePlans('not a list')).toEqual([]);
  });

  it('does not drop a tick on a step that only some visitors have', () => {
    const ids = knownItemIds('finance').map((i) => i.id);
    for (const id of ['keep', 'time', 'edu', 'apply']) expect(ids).toContain(id);
    // A direction that can be either way has both paths.
    expect(knownItemIds('tourism').map((i) => i.id)).toEqual(jasmine.arrayContaining(['calc', 'apply']));
    const [plan] = parsePlans([{ ...startPlan('finance'), done: ['keep', 'time', 'gone'] }]);
    expect(plan.done).toEqual(['keep', 'time']);
  });
});
