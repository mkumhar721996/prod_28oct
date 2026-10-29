import { BETS } from './game.constants';
import { splitContribution } from './jackpot';

describe('splitContribution', () => {
  it('AC7: a bet of 100 gives 2, 1.5, 1 and 0.5 credits in cents', () => {
    expect(splitContribution(100)).toEqual({ mini: 200, minor: 150, major: 100, grand: 50 });
  });

  it('AC6: a bet of 100 adds 5 credits (500 cents) in total', () => {
    const t = splitContribution(100);
    expect(t.mini + t.minor + t.major + t.grand).toBe(500);
  });

  it('AC11: a bet of 25 rounds the halves up', () => {
    expect(splitContribution(25)).toEqual({ mini: 50, minor: 38, major: 25, grand: 13 });
  });

  it.each([
    [10, { mini: 20, minor: 15, major: 10, grand: 5 }],
    [50, { mini: 100, minor: 75, major: 50, grand: 25 }],
    [250, { mini: 500, minor: 375, major: 250, grand: 125 }],
  ])('splits a bet of %i', (bet, expected) => {
    expect(splitContribution(bet)).toEqual(expected);
  });

  it('never rounds a half down', () => {
    for (const bet of BETS) {
      const t = splitContribution(bet);
      expect(t.minor).toBeGreaterThanOrEqual((bet * 5 * 30) / 100);
      expect(t.grand).toBeGreaterThanOrEqual((bet * 5 * 10) / 100);
    }
  });
});
