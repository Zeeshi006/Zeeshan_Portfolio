import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@portfolio/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.ts'],
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/prisma/**',
    '!**/test/**',
    '!**/*.e2e-spec.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Coverage thresholds raised incrementally as new modules gain tests
  coverageThreshold: {},
  testEnvironment: 'node',
  testTimeout: 30_000,
};

export default config;
