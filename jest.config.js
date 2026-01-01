/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  setupFiles: ['whatwg-fetch'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
    '^.+\\.(js|jsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
