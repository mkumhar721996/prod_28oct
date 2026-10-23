/** E2E tests (supertest): run from TypeScript sources, no build needed. */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
};
