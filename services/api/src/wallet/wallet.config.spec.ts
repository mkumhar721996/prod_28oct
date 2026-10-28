import { INVALID_TOP_UP_WARNING, topUpCredits } from './wallet.config';

describe('topUpCredits', () => {
  it('defaults to 500 silently when unset, empty or valid', () => {
    const warn = jest.fn();
    expect(topUpCredits({}, warn)).toBe(500);
    expect(topUpCredits({ WALLET_TOP_UP_CREDITS: '' }, warn)).toBe(500);
    expect(topUpCredits({ WALLET_TOP_UP_CREDITS: '750' }, warn)).toBe(750);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(['0', '-5', '1.5', 'abc', '9007199254740993'])(
    'warns and falls back to 500 for %s',
    (bad) => {
      const warn = jest.fn();
      expect(topUpCredits({ WALLET_TOP_UP_CREDITS: bad }, warn)).toBe(500);
      expect(warn).toHaveBeenCalledWith(INVALID_TOP_UP_WARNING);
      expect(INVALID_TOP_UP_WARNING).toBe(
        'Invalid WALLET_TOP_UP_CREDITS value detected. Falling back to default value: 500.',
      );
    },
  );
});
