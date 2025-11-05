export default {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'scripts/**/*.js',
    '!scripts/**/*.test.js',
    '!scripts/firebase-config.js',
    '!scripts/firebase-config.example.js',
    '!scripts/cleanup-*.js'
  ],
  coverageDirectory: 'coverage',

  // カバレッジレポート形式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // カバレッジしきい値（重要なモジュールのみ）
  coverageThreshold: {
    'scripts/core/logger.js': {
      statements: 95,
      branches: 80,
      functions: 100,
      lines: 95
    },
    'scripts/state/yield-stats-state.js': {
      statements: 90,
      branches: 65,
      functions: 90,
      lines: 90
    },
    'scripts/state.js': {
      statements: 75,
      branches: 60,
      functions: 70,
      lines: 75
    }
  },

  moduleNameMapper: {
    '^firebase$': '<rootDir>/__mocks__/firebase.js',
    '^firebase/(.*)$': '<rootDir>/__mocks__/firebase.js'
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  transform: {},
  verbose: true
};
