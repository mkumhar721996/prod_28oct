import { addressError, isValidLine, phoneError } from './orders.validation';

describe('phoneError', () => {
  it.each([
    ['123456789', true],
    ['0123456789', false],
    ['123456789012345', false],
    ['1234567890123456', true],
    ['+91 (98765) 432-10', false],
    ['98765abc10', true],
    ['', true],
  ])('%s -> invalid: %s', (phone, invalid) => {
    expect(phoneError(phone)).toBe(invalid);
  });
});

describe('addressError', () => {
  it.each([
    ['12 MG Road, Bengaluru, 560103', false],
    ['12 MG Road, Bengaluru, 110001', false],
    ['12 MG Road, Bengaluru', true],
    ['12 MG Road, Bengaluru, 5601', true],
    ['12 MG Road, Bengaluru, 56010A', true],
    ['12 MG Road, Bengaluru, 5601033', true],
    ['12 MG Road, , 560103', true],
    ['', true],
  ])('%s -> invalid: %s', (address, invalid) => {
    expect(addressError(address)).toBe(invalid);
  });
});

describe('isValidLine', () => {
  const line = { id: 'p1', name: 'Pizza', unitPrice: 900, quantity: 2 };
  it('accepts a good line', () => expect(isValidLine(line)).toBe(true));
  it.each([
    { ...line, id: ' ' },
    { ...line, name: '' },
    { ...line, unitPrice: -1 },
    { ...line, unitPrice: Number.NaN },
    { ...line, quantity: 0 },
    { ...line, quantity: 1.5 },
    { ...line, quantity: 100 },
    { ...line, name: 'x'.repeat(201) },
    { ...line, id: 'x'.repeat(101) },
    null,
  ])('rejects %j', (bad) => expect(isValidLine(bad)).toBe(false));
});
