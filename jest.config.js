module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
  ],
};
