'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { price, streetKey, parseZones } = require('../scripts/build-landprice');
const LAND = require('../src/property-intel/data/land-price.json');

describe('Land price table (Resolution 52/2025/NQ-HĐND)', () => {
  it('reads the mixed number formats of the workbook as million VND/m²', () => {
    assert.equal(price(96.249), 96.249); // 96,249 thousand VND
    assert.equal(price('17.910'), 17.91); // Vietnamese-formatted text
    assert.equal(price(974), 0.974); // raw thousands
    assert.equal(price('—'), null);
    assert.equal(price(0), null);
  });

  it('turns table street names into matching keys', () => {
    assert.equal(streetKey('Âu Cơ (Trong đê)'), 'âu cơ');
    assert.equal(streetKey('An Dương Vương (đường gom chân đê) đoạn ngoài đê'), 'an dương vương');
    assert.equal(streetKey('Phố Hàng Ngang'), 'hàng ngang');
    assert.equal(streetKey('- Đường 23B'), '23b');
  });

  it('parses a zone sheet: the wards it applies to and the residential VT1 price of each street', () => {
    const sheet = {
      rows: [
        ['Phụ lục số 01'],
        ['BẢNG GIÁ ĐẤT KHU VỰC 1'],
        ['Áp dụng đối với các thửa đất thuộc địa giới hành chính các phường: Tây Hồ, phường Ngọc Hà, Hoàn Kiếm'],
        ['Đơn vị tính: 1000đ/m2'],
        ['TT', 'Tên đường phố', 'Đoạn đường', null, 'Giá đất ở'],
        [null, null, 'Từ', 'Đến', 'VT1', 'VT2', 'VT3', 'VT4', 'VT1'],
        [1, 'Hàng Ngang', 'Đầu đường', 'Cuối đường', 702.194, 300, 200, 100, 250],
        [2, 'Âu Cơ (Trong đê)', 'A', 'B', 114.58],
        [null, 'Âu Cơ (Trong đê)', 'B', 'C', '176.850'],
      ],
    };
    const [zone] = parseZones([sheet]);
    assert.deepEqual(zone.wardNames, ['Tây Hồ', 'Ngọc Hà', 'Hoàn Kiếm']);
    assert.deepEqual(zone.streets.map((s) => [s.key, s.vt1]), [['hàng ngang', 702.2], ['âu cơ', 114.6], ['âu cơ', 176.9]]);
  });

  it('has the 2026 snapshot: 17 zones, the highest street price in the old quarter', () => {
    assert.equal(LAND.zones.length, 17);
    assert.equal(LAND.zones[0].maxVT1, 702.2);
    assert.equal(LAND.wards['phuong-hoan-kiem'].maxVT1, 702.2);
    const withOwnStreets = Object.values(LAND.wards).filter((w) => w && !w.zoneOnly);
    assert.ok(withOwnStreets.length >= 60);
  });
});
