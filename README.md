# Automation Framework

[![E2E Test Suite](https://github.com/sarvesh140/Automation_Framework/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/sarvesh140/Automation_Framework/actions/workflows/e2e-tests.yml)

Playwright + TypeScript test automation for **SatoriXR** (dev environment: `DEV_BASE_URL` in `.env`), reporting through **Allure Report 3**.

## Table of contents

- [Stack](#stack)
- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Page Object Model](#page-object-model)
- [Authentication](#authentication)
- [API service layer](#api-service-layer)
- [Consistency tests (cross-checking two sources of truth)](#consistency-tests-cross-checking-two-sources-of-truth)
- [Workflow tests (multi-step user journeys)](#workflow-tests-multi-step-user-journeys)
- [Data-driven, atomic tests](#data-driven-atomic-tests)
- [Tags](#tags)
- [Setup](#setup)
- [Environment variables (`.env`)](#environment-variables-env)
- [Running tests](#running-tests)
- [Reporting (Allure Report 3)](#reporting-allure-report-3)
- [Parallelization](#parallelization)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [License](#license)

## Stack

- [Playwright Test](https://playwright.dev/) — test runner (UI + API)
- TypeScript, strict mode
- [Allure Report 3](https://allurereport.org/docs/v3/) (`allure`, `allure-playwright`) — HTML reporting
- `dotenv` — loads `.env` into `playwright.config.ts`

## Prerequisites

- **Node.js** ≥ 18 (see `engines` in [`package.json`](package.json)) and npm
- Git
- Network access to the target `DEV_BASE_URL` environment and to the account credentials (`EMAIL`/`OTP`) used by the `login` project

## Project structure

```
pages/            Page Object Model classes (BasePage + page-specific classes)
services/         API service classes (ApiService — typed wrapper over /api/*)
helpers/          Shared test utilities/fixtures (auth-fixtures, api-fixtures, cross-fixtures)
fixtures/         Test data (e.g. home.json — expected page content used by tests/ui/home)
.auth/            Saved logged-in session (state.json — gitignored)
tests/
  ui/             Browser-driven tests (Playwright `page` fixture)
    Login/        Unauthenticated
    home/         Authenticated (via helpers/auth-fixtures.ts)
    Experiences/  Authenticated — 3D viewer interactions (see docs/GOTCHAS.md)
  api/            HTTP-level tests (Playwright `request` fixture, no browser)
  workflow/       End-to-end user journeys spanning multiple UI actions (e.g. upload → verify → delete), cross-checked against the API
    background_management/  HDRI upload/delete lifecycle vs /api/hdri
    material_management/    Solid-colour material add/edit/delete lifecycle vs /api/material-presets
    analytics/              Org-wide dashboard → Experience Performance drilldown → back, vs /api/new-analytics/dashboard
    branding/               Company logo + name save, then an experience still renders, vs /api/settings
    login/                  Email-OTP login setup/teardown — writes and deletes .auth/state.json (see "Authentication" below)
    usage/                  Credits breakdown dimension switches + CSV export, tour Storage/Views tabs, vs /api/credits
  consistency/    Cross-checks between two sources of truth (UI vs API, or API vs API)
    home/         Home dashboard cards vs /api/stats
    experiences/  Experiences filters/sort vs /api/scenes + /api/products
    products/     Products filters/sort vs /api/products
    analytics/    /api/new-analytics/events vs /summary + /portfolio
    usage/        Usage page credits (UI) vs /api/credits
    api/          Cross-endpoint checks not tied to one page (stats/analytics/settings/auth)
playwright.config.ts
run-tests.bat     Windows: runs the suite then generates + opens the Allure report
run-tests.sh      macOS/Linux/Git Bash: same, via `npm run test:report`
```

Tests are split into `tests/ui`, `tests/api`, `tests/workflow`, and `tests/consistency` so each layer can be run, tagged, and reported on independently. Add new suites under whichever folder matches how the test drives the app: purely through the browser, purely over HTTP, a multi-step user journey (`tests/workflow`, see below), or — if it asserts that two sources of truth agree (a UI count matches an API response, or one API response matches another) — under `tests/consistency`, partitioned by the page/feature it's validating (see "Consistency tests" below).

## Page Object Model

Every page object extends [`pages/base-page.ts`](pages/base-page.ts), which wraps the common `Page` operations (`goto`, `waitForLoad`, `title`). Example: [`pages/login-page.ts`](pages/login-page.ts) exposes locators for the login screen and an `open()` method that navigates to `DEV_BASE_URL`.

```ts
const loginPage = new LoginPage(page);
await loginPage.open();
await expect(loginPage.heading).toBeVisible();
```

A few non-obvious behaviors to know before touching page objects (full rationale in [docs/GOTCHAS.md](docs/GOTCHAS.md#page-object-model)):

- `BasePage.goto()` waits for `'domcontentloaded'`, not Playwright's default `'load'` — the app never reliably fires `load`.
- Async-loading pages (e.g. Home) wait for one known-slow element in `open()` rather than a fixed timeout — see [`pages/home-page.ts`](pages/home-page.ts).
- `LoginPage.open()` navigates directly to `/login` instead of relying on a redirect from the root, to avoid asserting against the SPA's transient dashboard shell.
- The 3D viewer ([`pages/experience-viewer-page.ts`](pages/experience-viewer-page.ts)) exposes no camera API, so zoom/rotate is verified via canvas screenshot diffing, and "model loaded" is detected by the rendered frame going byte-stable — not by the loading overlay disappearing.
- There are no pixel-snapshot tests in the suite currently (archived under gitignored `local-archive/experiences-snapshot-test/`); if you reintroduce one, budget a `maxDiffPixels` tolerance for WebGL's non-bit-exact output.

## Authentication

The app gates most pages behind an email-OTP login. Rather than logging in inside every test, Playwright's [project dependencies](https://playwright.dev/docs/auth) drive the OTP flow once per run and hand the resulting session to everything else:

- **`login` project** ([`tests/workflow/login/login.setup.ts`](tests/workflow/login/login.setup.ts)) opens `/login`, submits `EMAIL`, waits for the verification-code screen, fills in `OTP` (both from `.env`), submits, and writes the authenticated session to `.auth/state.json` (`AUTH_STORAGE_STATE`).
- **`tests` project** (everything under `testDir`) declares `dependencies: ['login']` in [`playwright.config.ts`](playwright.config.ts), so the login setup always runs first — regardless of whether you run the full suite, a single file, or a `--grep` subset.
- **`cleanup` project** ([`tests/workflow/login/login.teardown.ts`](tests/workflow/login/login.teardown.ts)) is wired up as the `tests` project's `teardown`, so it deletes `.auth/state.json` once after the run finishes (pass or fail) — the session file never lingers between runs.

Individual specs consume the saved session the same way as before:

- **Login UI spec** (`tests/ui/Login`) imports `test`/`expect` from `@playwright/test` directly — it needs a clean, unauthenticated context to check the login page itself, and doesn't touch `state.json`.
- **Everything else** (e.g. `tests/ui/home`) imports from [`helpers/auth-fixtures.ts`](helpers/auth-fixtures.ts) (or `helpers/api-fixtures.ts` / `helpers/cross-fixtures.ts` for API/consistency suites) instead, which override Playwright's `storageState` option to point at `.auth/state.json`.

If authenticated tests start failing with a 401/redirect-to-login mid-run, check the `login` project's output first — a stale `EMAIL`/`OTP` pair is now the far more common cause than an expired manual session.

## API service layer

[`services/api_service.ts`](services/api_service.ts) exports `ApiService`, a typed wrapper over the app's `/api/*` endpoints (`getStats`, `getProducts`, `getScenes`, `getCategories`, `getSettings`, `getUsers`, `getAnalyticsPortfolio`, `getAnalyticsFilters`, `verifyToken`, plus small derived helpers like `getActiveProductsCount`). It's the API-test equivalent of a page object: every endpoint call is wrapped in `test.step(...)` so it shows up named in the Playwright/Allure report, and a non-200 response throws a typed `APIError` instead of returning a malformed body silently.

[`helpers/api-fixtures.ts`](helpers/api-fixtures.ts) provides a `dashboardApi` worker-scoped fixture that constructs `ApiService` with an authenticated `APIRequestContext` (it reads the bearer token out of `.auth/state.json`, the same session file the UI tests use). Plain API suites (`tests/api/*`) import `test`/`expect` from there directly.

[`helpers/cross-fixtures.ts`](helpers/cross-fixtures.ts) layers `storageState` on top of `api-fixtures`, giving a single `test` that has **both** an authenticated `page` (browser) and `dashboardApi` (HTTP) available in the same test — this is what `tests/consistency` specs use.

## Consistency tests (cross-checking two sources of truth)

`tests/consistency` holds tests that assert two independent sources agree, rather than testing either source in isolation:

```
tests/consistency/
  home/          Dashboard cards (UI) vs /api/stats
  experiences/   Category/status/sort filters (UI) vs /api/scenes + /api/products
  products/      Category/status/sort filters (UI) vs /api/products
  analytics/     Analytics events (API) vs the summary/portfolio aggregations of the same data
  usage/         Credits consumed + per-user breakdown (UI) vs /api/credits
  api/           Cross-endpoint checks not tied to one page (stats vs analytics vs settings vs auth)
```

Partition new consistency suites by the page/feature they validate, same as `tests/ui`/`tests/api`; if a check spans multiple endpoints with no single owning page (like the existing `api/` bucket), that's the fallback location.

The pattern, illustrated by [`tests/consistency/experiences/experiences_filters.spec.ts`](tests/consistency/experiences/experiences_filters.spec.ts): the Experiences page has no server-side filter endpoint — category/sort/status are all applied client-side against the `/api/scenes` + `/api/products` payloads already fetched on load (confirmed by tracing the live app's network requests while operating each filter — no new request fired). So the test fetches that same raw data via `dashboardApi`, replicates the app's own filtering/sorting logic in plain JS, and asserts the UI's rendered card titles match exactly, in order:

```ts
test('category_filter_matches_linked_products_in_api', async ({ page, dashboardApi }) => {
  const [scenesResponse, products] = await Promise.all([
    dashboardApi.getScenes(),
    dashboardApi.getProducts(),
  ]);
  const automotiveProductIds = new Set(
    products.filter(p => p.category === 'automotive').map(p => p.id)
  );
  // Replicate the app's own client-side filter + sort, then take the first page.
  const expected = scenesResponse.scenes
    .filter(s => s.status !== 'archived' && automotiveProductIds.has(s.productId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 12)
    .map(s => s.name);

  const experiencePage = new ExperiencePage(page);
  await experiencePage.open();
  await experiencePage.filterByCategory('Automotive');

  expect(await experiencePage.visibleCardTitles()).toEqual(expected);
});
```

Note: the rendered card title is `scene.name`, not `scene.displayTitle` — the two fields can differ, so verify which one the UI actually renders before writing an expected-value comparison (details in [docs/GOTCHAS.md](docs/GOTCHAS.md#consistency-tests)).

## Workflow tests (multi-step user journeys)

`tests/workflow` holds tests that drive a full user journey through several UI actions in sequence — e.g. `tests/workflow/background_management/hdri_upload_delete.spec.ts` uploads an HDRI, asserts the success message, deletes it, and asserts the row is gone — rather than checking one page in isolation (`tests/ui`) or one thing two sources agree on (`tests/consistency`). Because each step depends on the state the previous step left behind, these are written as one `test()` with a `test.step(...)` per action (see "Tags" below for reporting) rather than split into atomic tests — unlike `tests/ui`/`tests/api`, atomicity isn't achievable here without re-doing the setup for every assertion.

Each workflow spec also cross-verifies its result against the matching `/api/*` endpoint via `dashboardApi` (imported from `helpers/cross-fixtures`, the same fixture `tests/consistency` uses) — e.g. after deleting "sky" through the UI, the test re-fetches `/api/hdri` and asserts it's actually gone server-side, not just hidden from the table.

Because these tests mutate shared, persistent server state (not local fixtures), each spec's `test.afterEach` re-fetches the resource and deletes any leftover created during the test — a safety net for when an assertion mid-flow fails and the normal delete step never runs, so a broken run doesn't permanently pollute the shared environment other tests/users see.

A few non-obvious behaviors to know before touching workflow specs (full rationale in [docs/GOTCHAS.md](docs/GOTCHAS.md#workflow-tests)):

- Delete actions typically require confirming a modal — the row icon alone doesn't fire the `DELETE` request; check for this pattern before assuming a control acts directly.
- Some form controls (e.g. "Remove logo") fire their own request independently of the form's main Save button — page-object methods for such controls must await their own request/response, not just the click.
- Workflow cleanup restores pre-test state captured live via the API in `beforeAll`, never hardcoded fixture defaults, so a broken run can't overwrite real tenant data with a guess.
- Catalog/list grids paginate — tests targeting a specific card must search/filter first rather than assuming `open()` renders the whole catalog.
- Workflow specs set `test.use({ video: 'on' })` at module level so recordings are kept for passing runs too, not just failures.

## Data-driven, atomic tests

`tests/ui/home/home.spec.ts` is the reference pattern for new UI suites: expected page content lives in a `fixtures/*.json` file, and the spec generates one `test()` per data item at module-load time (not a loop inside a single test), so each check gets its own row in the Playwright/Allure report and fails independently:

```ts
import homeData from '../../../fixtures/home.json';

for (const cardTitle of homeData.expected_cards) {
  test(`${cardTitle} card is visible`, { tag: ['@smoke'] }, async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.open();
    await expect(homePage.overviewCard(cardTitle)).toBeVisible();
  });
}
```

Each test asserts exactly one thing. Prefer this over one big test with many assertions — a single failure then tells you precisely which card/nav item/label broke, instead of "something in this test failed."

## Tags

Tests are tagged using Playwright's built-in `tag` option on `test.describe`/`test`, so they show up in both the console output and the Allure report.

| Tag             | Meaning                                            |
|-----------------|------------------------------------------------------|
| `@ui`           | Browser-driven test (`tests/ui`)                    |
| `@api`          | HTTP-level test (`tests/api`)                       |
| `@consistency`  | Cross-check between two sources of truth (`tests/consistency`) |
| `@workflow`     | Multi-step user journey (`tests/workflow`)           |
| `@regression`   | Part of the core regression suite                   |
| `@smoke`        | Fast, critical-path check                           |

Two levels of granularity are in use, pick whichever fits the suite:

- **Blanket, describe-level** (`tests/ui/Login`, `tests/api/manifest`, everything in `tests/consistency`) — every test in the file gets the same tags: `{ tag: ['@ui', '@regression'] }` on `test.describe`.
- **Per-test** (`tests/ui/home`) — `@ui` is set once on the outer `describe`, then each individual `test()` additionally gets `@smoke` or `@regression` depending on how critical/expensive it is. Use this when a suite has a mix of fast sanity checks and slower/more thorough ones.

Add more tags as the suite grows (e.g. `@critical`, `@cross-browser`) — apply them the same way:

```ts
test.describe('Login', { tag: ['@ui', '@regression'] }, () => {
  test('...', async ({ page }) => { ... });
});
```

Run a subset by tag with `--grep`:

```bash
npx playwright test --grep @api
npx playwright test --grep @regression
```

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # adjust values if needed
```

## Environment variables (`.env`)

| Variable             | Purpose                                  | Default (`.env.example`)          |
|----------------------|-------------------------------------------|-------------------------------------|
| `DEV_BASE_URL`       | Target app URL used by tests and `playwright.config.ts`'s `use.baseURL` | `https://dev.devsatorixr.com` |
| `AUTH_STORAGE_STATE` | Path to the saved logged-in session, written by the `login` project and read by `helpers/auth-fixtures.ts` | `./.auth/state.json` |
| `EMAIL`              | Account email the `login` project submits on the login form | `test1@satorixr.com` |
| `OTP`                | Verification code the `login` project submits on the OTP screen | `123456` |
| `HEADED`             | Set to `true` to run with a visible browser window; anything else (including unset) runs headless | unset (headless) |

API tests derive the origin from `DEV_BASE_URL` (e.g. `https://dev.devsatorixr.com`) rather than hardcoding it, so changing `DEV_BASE_URL` repoints both UI and API tests.

## Running tests

```bash
npm test                 # everything (tests/ui + tests/api + tests/consistency)
npm run test:ui           # UI suite only
npm run test:api          # API suite only
npm run test:regression   # anything tagged @regression
npx playwright test tests/consistency   # consistency suite only (no dedicated npm script yet)

HEADED=true npx playwright test tests/ui/Login   # watch it run in a real browser window
```

## Reporting (Allure Report 3)

Test results are written to `allure-results/` by the `allure-playwright` reporter (configured in `playwright.config.ts`). Generate and view the HTML report:

```bash
npm run report:generate   # builds ./allure-report from ./allure-results (allure awesome)
npm run report:open       # serves ./allure-report locally and opens it in your browser
```

Or do both, plus the test run itself, in one step:

```bash
run-tests.bat   # Windows
./run-tests.sh  # macOS/Linux/Git Bash — also invoked by `npm run test:report`
```

Both scripts clean `allure-results`/`allure-report`, run the full suite, then generate and open the report.

On failure, a screenshot and video of the page are captured automatically (`use.screenshot`/`use.video` in `playwright.config.ts`) and attached to both the Playwright HTML report and the Allure report. Tests can also attach their own images explicitly via `testInfo.attach(name, { body, contentType })` — useful for canvas/WebGL work, where attaching the before/after frames lets a reviewer see the effect directly in the report rather than just a pass/fail.

## Parallelization

`fullyParallel: true` runs every test concurrently (not just separate files) up to the configured `workers` count — `4` locally, `2` in CI (`process.env.CI`). Override per-run with `--workers=N`, e.g. `npx playwright test --workers=1` to debug flaky tests in isolation.

Each worker launches its own browser once and reuses it across its tests (only `context`/`page` are recreated per test), so per-test cost mainly reflects navigation and the live app's response time, not browser startup. Raising `workers` further hasn't reliably improved wall-clock time — the bottleneck is the live app's backend, not local CPU — and a shared worker-scoped browser context was deliberately avoided because it would break Playwright's automatic per-test screenshot/video/trace capture. See [docs/GOTCHAS.md](docs/GOTCHAS.md#parallelization) for the measurements behind these conclusions before attempting performance changes here.

Report/result output (`allure-results/`, `allure-report/`, `playwright-report/`, `test-results/`) is gitignored — regenerate it locally or in CI as needed.

## CI/CD

[`.github/workflows/e2e-tests.yml`](.github/workflows/e2e-tests.yml) runs the suite on GitHub Actions (`ubuntu-latest`, Chromium only, 60-minute timeout).

- **Trigger:** manual only (`workflow_dispatch`) — there is no on-push/on-PR trigger. Run it from the repo's **Actions** tab, choosing which suite to execute:

  | Input value | Runs |
  |-------------|------|
  | `all` *(default)* | `npx playwright test` — the full suite |
  | `api` | `tests/api` |
  | `ui` | `tests/ui` |
  | `workflow` | `tests/workflow` |

  Note: `tests/consistency` has no dedicated option yet (matches the "no dedicated npm script" gap noted under [Running tests](#running-tests)) — pick `all` to include it.

- **Required repository secrets** (Settings → Secrets and variables → Actions): `DEV_BASE_URL`, `EMAIL`, `OTP` — mirror the [environment variables](#environment-variables-env) `.env` normally provides. `HEADED` is hardcoded to `'false'` in the workflow.
- **Steps:** checkout → `actions/setup-node@v4` (Node 20, npm cache) → `npm ci` → `npx playwright install --with-deps chromium` → run the selected suite.
- **Artifacts:** on every run (pass or fail), `allure-results/` and `test-results/`/`playwright-report/` are uploaded as `allure-results-<suite>` / `playwright-report-<suite>`, retained 14 days — download them from the run's summary page to inspect failures without re-running locally.

Before the workflow can succeed, the three secrets above must be configured on the GitHub repository; without them the `login` project fails immediately and every downstream test is skipped.

## Contributing

- Match new tests to the existing layout: `tests/ui` for pure browser checks, `tests/api` for pure HTTP checks, `tests/workflow` for multi-step journeys that mutate server state, `tests/consistency` for cross-checks between two sources of truth (see the sections above for how to choose).
- Reuse the Page Object Model (extend [`pages/base-page.ts`](pages/base-page.ts)) and the API service layer ([`services/api_service.ts`](services/api_service.ts)) instead of driving locators or `request.get(...)` directly from a spec.
- Tag every new `test`/`describe` per the [Tags](#tags) table so it's filterable via `--grep` and shows up correctly in Allure.
- Read [docs/GOTCHAS.md](docs/GOTCHAS.md) before touching the 3D viewer, HDRI/branding workflow specs, or auth — it documents real, previously-hit races and bugs, not hypothetical edge cases.
- Keep `.env`, `.auth/`, and other gitignored paths out of commits; never hardcode `EMAIL`/`OTP`/`DEV_BASE_URL` into source.
- Run the relevant suite locally (`npm test` / `npm run test:ui` / `npm run test:api`) before opening a PR.

## License

`UNLICENSED` (see [`package.json`](package.json)) — private, internal SatoriXR project. Not published or licensed for external use.
