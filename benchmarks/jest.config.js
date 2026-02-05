/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Jest configuration for performance benchmarks.
 *
 * These benchmarks are intended to be run manually for performance analysis,
 * not as part of CI/CD pipelines. Run with: npm run benchmark
 */

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  displayName: "benchmarks",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["**/*.bench.ts"],
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json"
      }
    ]
  },
  // Increase timeout for long-running benchmarks
  testTimeout: 120000,
  // Disable coverage for benchmarks
  collectCoverage: false,
  // Verbose output to see timing details
  verbose: true
};
