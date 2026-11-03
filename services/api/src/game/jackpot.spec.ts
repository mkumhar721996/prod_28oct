import { splitContribution } from './jackpot';

const total = (t: ReturnType<typeof splitContribution>) => t.mini + t.minor + t.major + t.grand;

describe('splitContribution', () => {
  it('AC6: a bet of 100 adds 5.00 (500 cents) to the pool', () => {
    expect(total(splitContribution(100))).toBe(500);
  });

  it('AC7: a bet of 100 adds 2, 1.5, 1 and 0.5 to Mini, Minor, Major and Grand', () => {
    expect(splitContribution(100)).toEqual({ mini: 200, minor: 150, major: 100, grand: 50 });
  });

  it('AC11: a bet of 25 adds 0.50, 0.38, 0.25 and 0.13, halves rounded up', () => {
    expect(splitContribution(25)).toEqual({ mini: 50, minor: 38, major: 25, grand: 13 });
  });

  it.each([
    [10, { mini: 20, minor: 15, major: 10, grand: 5 }],
    [50, { mini: 100, minor: 75, major: 50, grand: 25 }],
    [250, { mini: 500, minor: 375, major: 250, grand: 125 }],
  ])('splits a bet of %i exactly', (bet, tiers) => {
    expect(splitContribution(bet)).toEqual(tiers);
  });
});
