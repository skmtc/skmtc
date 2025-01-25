/** @type {import('ts-jest').JestConfigWithTsJest} */
import path from 'path'

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: false,
  collectCoverage: true,
  coverageDirectory: './src/tests/coverage',
  coverageReporters: ['json-summary', 'text', 'lcov'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '<rootDir>/src/**/*.tsx'],
  coveragePathIgnorePatterns: ['<rootDir>[/\\\\](node_modules)[/\\\\]', '__styles__', '.d.ts', 'src/index.tsx'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['./src/scripts/tests/setup-tests.ts'],
  moduleNameMapper: {
    '^.+\\.svg$': 'jest-svg-transformer',
    '^.+.(?=.*scss|sass|css|png|jpg|pdf|jpeg).*': path.join(__dirname, './src/scripts/tests/string-stub.ts'),
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
