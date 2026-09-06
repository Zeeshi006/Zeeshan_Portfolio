import type { Config } from 'jest';

// Integration tests — run serially (--runInBand) so containers are shared within a suite.
// Each spec file manages its own container lifecycle via beforeAll/afterAll.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@portfolio/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
  testEnvironment: 'node',
  testTimeout: 120_000, // containers can take 30-60s to start
  runInBand: true,      // serial — prevents container port conflicts
};

export default config;
