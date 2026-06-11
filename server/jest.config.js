/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  verbose: true,
  // Give individual tests up to 15 s (some AI fallback tests fire actual API
  // calls on machines where GROQ_API_KEY is loaded from .env before setup.ts
  // can clear it — the mock below covers that, but the timeout is a safe guard).
  testTimeout: 15000,
  // Force Jest to exit after all tests complete even if there are open handles
  // (the store's debounced PG save timer keeps the process alive otherwise).
  forceExit: true,
};
