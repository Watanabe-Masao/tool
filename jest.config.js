export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'scripts/**/*.js',
    '!scripts/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^firebase$': '<rootDir>/__mocks__/firebase.js',
    '^firebase/(.*)$': '<rootDir>/__mocks__/firebase.js'
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  transform: {}
};
