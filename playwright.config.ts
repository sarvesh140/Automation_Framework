import 'dotenv/config';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ['line'],
    ['allure-playwright', { resultsDir: './allure-results' }],
  ],
  use: {
    baseURL: process.env.DEV_BASE_URL,
    // Set HEADED=true to run with a visible browser window; defaults to headless.
    headless: process.env.HEADED !== 'true',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Logs in via email OTP once and writes .auth/state.json. Runs before every
      // other test regardless of which subset/path/grep filter the run uses —
      // Playwright always executes a project's dependencies first.
      name: 'login',
      testMatch: /login\.setup\.ts/,
    },
    {
      // Deletes .auth/state.json. Wired up as `tests`' teardown below, so it runs
      // once after all tests finish (pass or fail), not as a test file on its own.
      name: 'cleanup',
      testMatch: /login\.teardown\.ts/,
    },
    {
      // Pure-API specs (no browser `page`, just the worker-scoped `dashboardApi`
      // fixture). fullyParallel:true on the 'tests' project below lets even one
      // file's tests be scattered across multiple workers — since dashboardApi is
      // worker-scoped, that meant a file's beforeAll (and its own APIRequestContext)
      // ran once per worker it landed on instead of once. fullyParallel:false here
      // keeps each file's tests on a single worker (files still run in parallel
      // against each other) so beforeAll/dashboardApi is created exactly once per
      // file — without the cascading skip-on-failure that describe-level `serial`
      // mode would introduce for these otherwise-independent assertions.
      name: 'api-tests',
      testMatch: [
        'api/**/*.spec.ts',
        'consistency/api/**/*.spec.ts',
        'consistency/analytics/**/*.spec.ts',
      ],
      fullyParallel: false,
      dependencies: ['login'],
    },
    {
      name: 'tests',
      testMatch: /.*\.spec\.ts/,
      testIgnore: [
        'api/**/*.spec.ts',
        'consistency/api/**/*.spec.ts',
        'consistency/analytics/**/*.spec.ts',
      ],
      // Depends on api-tests (not just login) so the single 'cleanup' teardown below
      // only fires once, after everything — not while api-tests might still be running.
      dependencies: ['login', 'api-tests'],
      teardown: 'cleanup',
    },
  ],
});
