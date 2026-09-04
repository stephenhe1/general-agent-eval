/**
 * Evaluator-side Playwright config. Identical for the clean runs and every bug
 * run: only the WTP_BUG_SCRIPT environment variable differs, so instrumentation
 * cannot bias one arm relative to another.
 */
import { defineConfig, devices } from '@playwright/test';

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set by the evaluator`);
  return value;
};

const VIEWPORT = { width: 1280, height: 720 };

export default defineConfig({
  testDir: need('WTP_TEST_DIR'),
  outputDir: need('WTP_ARTIFACT_DIR'),
  // Serial, no retries: the applications are stateful, and a retry would let a
  // test that failed under injection pass on a second attempt.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: false,
  reportSlowTests: null,
  timeout: Number(process.env.WTP_TEST_TIMEOUT_MS || 90_000),
  globalTimeout: Number(process.env.WTP_GLOBAL_TIMEOUT_MS || 3_600_000),
  reporter: [['json', { outputFile: need('WTP_JSON_REPORT') }], ['line']],
  use: {
    baseURL: need('WTP_BASE_URL'),
    viewport: VIEWPORT,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    actionTimeout: Number(process.env.WTP_ACTION_TIMEOUT_MS || 15_000),
    navigationTimeout: Number(process.env.WTP_NAV_TIMEOUT_MS || 30_000),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: VIEWPORT } },
  ],
});
