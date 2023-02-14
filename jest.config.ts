/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  'clearMocks': true,
  'collectCoverage': true,
  'coverageProvider': 'v8',
  'rootDir': 'src',
  'testRegex': '.*\\.spec\\.ts$',
  'transform': {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  'collectCoverageFrom': [
    '**/*.(t|j)s',
  ],
  'coverageDirectory': '../coverage',
  'testEnvironment': 'node',
  'moduleFileExtensions': [
    'js',
    'json',
    'ts',
  ],
  'testTimeout': 30000,
  "coveragePathIgnorePatterns": [
    "src/index.ts",
  ],
};