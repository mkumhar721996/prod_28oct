import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('returns the database url', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x' })).toEqual({ databaseUrl: 'postgres://x' });
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL is required');
  });
});
