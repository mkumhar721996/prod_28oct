import { SYMBOLS, drawReels, payoutFor } from './reels';

describe('drawReels', () => {
  it('AC2: draws three symbols from the symbol set', () => {
    expect(drawReels(() => 0)).toEqual(['cherry', 'cherry', 'cherry']);
    const reels = drawReels((max) => max - 1);
    expect(reels).toHaveLength(3);
    reels.forEach((symbol) => expect(SYMBOLS).toContain(symbol));
  });

  it('asks the generator for a number below the symbol count', () => {
    const randomInt = jest.fn(() => 1);
    drawReels(randomInt);
    expect(randomInt).toHaveBeenCalledTimes(3);
    expect(randomInt).toHaveBeenCalledWith(SYMBOLS.length);
  });
});

describe('payoutFor (placeholder paytable)', () => {
  it('AC3: two cherries pay 1x the bet', () => {
    expect(payoutFor(['cherry', 'cherry', 'bar'], 100)).toEqual({
      winCredits: 100,
      label: 'Two cherries pay 1× your bet.',
    });
  });

  it('AC3: three bells pay 10x the bet', () => {
    expect(payoutFor(['bell', 'bell', 'bell'], 25)).toEqual({
      winCredits: 250,
      label: 'Three bells pay 10× your bet.',
    });
  });

  it('AC4: anything else pays nothing', () => {
    expect(payoutFor(['bar', 'seven', 'cherry'], 100)).toEqual({ winCredits: 0, label: null });
    expect(payoutFor(['cherry', 'bar', 'bar'], 100)).toEqual({ winCredits: 0, label: null });
  });
});
