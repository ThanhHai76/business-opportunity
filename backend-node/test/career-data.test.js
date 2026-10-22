'use strict';
/** Data behind the career compass: driving times between wards, and the metro lines near wards and places of work. */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { loadConfig } = require('../src/living-score/config');
const M = require('../src/property-intel/model');

const PI = '/api/property-intel';

describe('Career compass data', () => {
  let server;
  let living;
  let base;

  before(async () => {
    const created = createApp({
      log: false,
      living: { config: loadConfig({ DATA_SOURCE: 'memory' }) },
      propertyIntel: { config: { aiProvider: 'mock' } },
      premium: { mode: 'off' },
    });
    living = created.living;
    server = await new Promise((resolve) => {
      const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await living.close();
  });

  const get = async (path) => {
    const res = await fetch(`${base}${PI}${path}`);
    return { status: res.status, body: await res.json(), headers: res.headers };
  };

  it('gives the minutes by car from a ward to every ward, with what the figures are', async () => {
    const { status, body, headers } = await get('/commute/phuong-tay-ho');
    assert.equal(status, 200);
    assert.equal(body.from, 'phuong-tay-ho');
    assert.equal(Object.keys(body.minutes).length, M.WARDS.length);
    assert.equal(body.minutes['phuong-tay-ho'], 0);
    assert.ok(Object.values(body.minutes).every((m) => m === null || (Number.isInteger(m) && m >= 0 && m < 180)));
    assert.match(body.source, /OSRM/);
    assert.match(body.note, /chưa tính kẹt xe/);
    assert.match(headers.get('cache-control'), /public/);
    assert.match((await get('/commute/phuong-tay-ho?lang=en')).body.note, /free-flow/);
  });

  it('is roughly symmetric and keeps near wards near', async () => {
    const a = (await get('/commute/phuong-tay-ho')).body.minutes;
    const b = (await get('/commute/phuong-cau-giay')).body.minutes;
    // Two wards of the inner city are close to each other whichever way you go, and the airport side is further.
    assert.ok(a['phuong-cau-giay'] <= 30);
    assert.ok(Math.abs(a['phuong-cau-giay'] - b['phuong-tay-ho']) <= 8);
  });

  it('gives the minutes by car from every ward to one place of work: a ward or a reference place', async () => {
    const ward = await get('/commute-to/phuong-cau-giay');
    assert.equal(ward.status, 200);
    assert.equal(ward.body.minutes['phuong-cau-giay'], 0);
    assert.equal(Object.keys(ward.body.minutes).length, M.WARDS.length);
    // Same figure as the row of the other direction (matrix): home Tây Hồ to work Cầu Giấy.
    const row = (await get('/commute/phuong-tay-ho')).body.minutes;
    assert.equal(ward.body.minutes['phuong-tay-ho'], row['phuong-cau-giay']);
    const offices = await get('/commute-to/offices');
    assert.equal(offices.status, 200);
    assert.match(offices.body.name, /Cầu Giấy/);
    assert.equal(offices.body.minutes['phuong-phuc-loi'], M.TRAVEL.wards['phuong-phuc-loi'].offices.minutes);
    assert.equal((await get('/commute-to/khong-co-noi-nay')).status, 404);
    assert.equal((await get('/commute-to/Bad%20Slug')).status, 400);
  });

  it('refuses an unknown or malformed ward', async () => {
    assert.equal((await get('/commute/khong-co-phuong-nay')).status, 404);
    assert.equal((await get('/commute/Bad%20Slug')).status, 400);
  });

  it('lists the metro lines near every ward and place of work at three horizons, each one adding to the last', async () => {
    const { status, body } = await get('/metro-reach');
    assert.equal(status, 200);
    assert.equal(Object.keys(body.wards).length, M.WARDS.length);
    for (const id of ['centre', 'offices', 'airport', 'hoa-lac']) assert.ok(body.places[id], id);
    for (const point of [...Object.values(body.wards), ...Object.values(body.places)]) {
      const { now, soon, plan } = point.lines;
      assert.ok(now.every((l) => soon.includes(l)) && soon.every((l) => plan.includes(l)));
    }
    // Cầu Giấy has Line 3 in service; Tây Hồ has no station within reach yet, only planned corridors.
    assert.deepEqual(body.wards['phuong-cau-giay'].lines.now, ['3']);
    assert.deepEqual(body.wards['phuong-tay-ho'].lines.now, []);
    assert.ok(body.wards['phuong-tay-ho'].lines.plan.length > 0);
    // More wards are served as stations open and lines are planned.
    const count = (h) => Object.values(body.wards).filter((w) => w.lines[h].length).length;
    assert.ok(count('now') > 0 && count('now') <= count('soon') && count('soon') < count('plan'));
  });

  it('says that a planned corridor is a sketch, and that a station under construction opens in 2027', async () => {
    const { body } = await get('/metro-reach');
    assert.equal(body.places['hoa-lac'].nearest.plan.schematic, true);
    assert.equal(body.places['hoa-lac'].nearest.plan.year, 2035);
    const building = Object.values(body.wards).find((w) => w.nearest.soon?.openYear);
    assert.equal(building.nearest.soon.openYear, 2027);
    // Nothing about travel time: the data has no timetable.
    assert.ok(!JSON.stringify(body).includes('minutes'));
  });
});
