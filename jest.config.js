module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/contract/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/performance/'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**',
    '!src/lambda/fixtures/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    },
    './src/backlog/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './src/lambda/': {
      branches: 65,
      functions: 65,
      lines: 65,
      statements: 65
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  collectCoverage: false,
  verbose: false,
  silent: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};