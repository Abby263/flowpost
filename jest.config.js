/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/backend"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@backend/(.*)$": "<rootDir>/backend/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  collectCoverageFrom: ["backend/**/*.ts", "!backend/**/*.d.ts"],
  coverageDirectory: "coverage/backend",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
};
