import { SYMBOLS, drawReels, payoutFor } from './reels';

describe('drawReels', () => {
  it('AC2: draws three symbols from the injected RNG', () => {
    expect(drawReels(() => 0)).toEqual(['cherry', 'cherry', 'cherry']);
    const seq = [1, 2, 3];
    let i = 0;
    expect(drawReels(() => seq[i++])).toEqual(['bell', 'bar', 'seven']);
  });

  it('only draws known symbols with the real RNG', () => {
    for (let n = 0; n < 50; n++) {
      const reels = drawReels((max) => Math.floor(Math.random() * max));
      expect(reels).toHaveLength(3);
      reels.forEach((s) => expect(SYMBOLS).toContain(s));
    }
  });
});

describe('payoutFor (placeholder paytable)', () => {
  it('AC3: two cherries pay 1x the bet', () => {
    expect(payoutFor(['cherry', 'cherry', 'bar'], 100)).toEqual({
      winCredits: 100,
      label: 'Two cherries pay 1× your bet.',
    });
  });

  it('three bells pay 10x the bet', () => {
    expect(payoutFor(['bell', 'bell', 'bell'], 25)).toEqual({
      winCredits: 250,
      label: 'Three bells pay 10× your bet.',
    });
  });

  it('AC4: anything else pays nothing', () => {
    expect(payoutFor(['bar', 'seven', 'cherry'], 100)).toEqual({ winCredits: 0, label: null });
  });
});
