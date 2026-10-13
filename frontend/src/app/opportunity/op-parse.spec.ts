import { parseIdeaLocal } from './op-parse';

describe('Reading a business idea in the browser', () => {
  const types = [
    { key: 'cafe', name: 'Quán cà phê' },
    { key: 'pharmacy', name: 'Nhà thuốc' },
  ];
  const wards = [
    { slug: 'phuong-ha-dong', name: 'Phường Hà Đông' },
    { slug: 'xa-dong-anh', name: 'Xã Đông Anh' },
  ];

  it('finds the type, the budget and the ward', () => {
    expect(parseIdeaLocal('Tôi có 500 triệu, muốn mở quán cà phê ở Hà Đông', types, wards)).toEqual({
      type: 'cafe',
      typeName: 'Quán cà phê',
      budget: 500_000_000,
      ward: { slug: 'phuong-ha-dong', name: 'Phường Hà Đông' },
    });
  });

  it('reads billions with decimals and full numbers', () => {
    expect(parseIdeaLocal('1,5 tỷ mở nhà thuốc', types, wards).budget).toBe(1_500_000_000);
    expect(parseIdeaLocal('vốn 800.000.000 đ', types, wards).budget).toBe(800_000_000);
  });

  it('returns nulls when nothing is recognised', () => {
    expect(parseIdeaLocal('xin chào', types, wards)).toEqual({ type: null, typeName: null, budget: null, ward: null });
  });
});
