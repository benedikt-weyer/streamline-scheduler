module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/'],
};