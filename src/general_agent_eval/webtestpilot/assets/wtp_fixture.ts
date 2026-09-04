/**
 * Evaluator-side Playwright fixture. Injects a WebTestPilot bug script into
 * every browser context the suite uses, and observes the official sentinel.
 *
 * Contract:
 *   WTP_BUG_SCRIPT   path to a prepared bug script; unset/empty => clean run
 *   WTP_SENTINEL_LOG NDJSON file this fixture appends activation records to
 *
 * The bug script itself is produced by WebTestPilot's own
 * baselines.bug_injector.prepare_bug_script and is used verbatim. This file adds
 * a separate, observation-only probe; it never edits the injector or the fault.
 */
import { test as base } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs';

const BUG_SCRIPT_PATH = process.env.WTP_BUG_SCRIPT || '';
const SENTINEL_LOG = process.env.WTP_SENTINEL_LOG || '';
const SENTINEL_KEY = '__BUG_INJECTOR_TRIGGERED__';
// Set by the mutation probe spliced into the prepared script (see bugs.py). The
// upstream sentinel fires whenever the *condition* matched; this one records whether
// the DOM actually changed, so a fault that no-opped is not scored as one the suite
// failed to notice.
const MUTATION_KEY = '__WTP_MUTATION_APPLIED__';

const bugScript: string = BUG_SCRIPT_PATH ? fs.readFileSync(BUG_SCRIPT_PATH, 'utf8') : '';
const injecting: boolean = bugScript.length > 0;

/**
 * Observation-only probe, injected as a SEPARATE init script. Mirrors the
 * sentinel out through a binding the moment it appears, so activation is not
 * lost when a tab closes before teardown can read sessionStorage.
 */
const PROBE_SCRIPT = `(() => {
  if (window.__wtpProbe) return;
  window.__wtpProbe = true;
  const check = () => {
    try {
      if (!window.__wtpSeen && sessionStorage.getItem(${JSON.stringify(SENTINEL_KEY)})) {
        window.__wtpSeen = true;
        const applied = sessionStorage.getItem(${JSON.stringify(MUTATION_KEY)});
        if (typeof window.__wtpArmed === 'function') {
          window.__wtpArmed('probe|mutated=' + (applied === null ? 'unknown' : applied));
        }
      }
    } catch (err) { /* storage unavailable on about:blank */ }
  };
  check();
  setInterval(check, 100);
})();`;

type ArmedRecord = { sources: Set<string>; mutated: Set<string> };
const armedByContext = new WeakMap<BrowserContext, ArmedRecord>();

/** Attach the fault and the probe to one context. Idempotent per context. */
async function instrumentContext(context: BrowserContext): Promise<void> {
  if (!injecting || armedByContext.has(context)) return;
  const record: ArmedRecord = { sources: new Set<string>(), mutated: new Set<string>() };
  armedByContext.set(context, record);

  await context.exposeBinding('__wtpArmed', (_source, how: string) => {
    const raw = String(how);
    record.sources.add(raw);
    const marker = raw.indexOf('mutated=');
    if (marker !== -1) record.mutated.add(raw.slice(marker + 'mutated='.length));
  });
  // Order matters: the fault first, then the probe that watches for its flag.
  await context.addInitScript({ content: bugScript });
  await context.addInitScript({ content: PROBE_SCRIPT });
}

/**
 * Cover a page that is already loaded when instrumentation happens. addInitScript
 * only affects future navigations, mirroring what WebTestPilot's own runner does
 * with add_init_script + evaluate.
 */
async function armLoadedPage(page: Page): Promise<void> {
  if (!injecting) return;
  for (const script of [bugScript, PROBE_SCRIPT]) {
    try {
      await page.evaluate(script);
    } catch (err) {
      // about:blank and cross-origin frames reject evaluation; the init script
      // still covers every real navigation.
    }
  }
}

/** Teardown sweep: returns the sentinel plus the mutation flag, when readable. */
async function readSentinel(
  context: BrowserContext,
): Promise<{ armed: boolean; mutated: string | null }> {
  for (const page of context.pages()) {
    if (page.isClosed()) continue;
    try {
      const seen = await page.evaluate(
        ([sentinel, mutation]) => ({
          armed: Boolean(window.sessionStorage.getItem(sentinel)),
          mutated: window.sessionStorage.getItem(mutation),
        }),
        [SENTINEL_KEY, MUTATION_KEY],
      );
      if (seen.armed) return seen;
    } catch (err) { /* page navigating or closed */ }
  }
  return { armed: false, mutated: null };
}

function record(entry: Record<string, unknown>): void {
  if (!SENTINEL_LOG) return;
  try {
    fs.appendFileSync(SENTINEL_LOG, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) { /* never fail a test over bookkeeping */ }
}

export * from '@playwright/test';

export const test = base.extend({
  // Wrap the browser so contexts the tests create themselves are covered too.
  browser: async ({ browser }, use) => {
    if (injecting) {
      const originalNewContext = browser.newContext.bind(browser);
      (browser as { newContext: typeof browser.newContext }).newContext = async (
        ...args: Parameters<typeof originalNewContext>
      ) => {
        const context = await originalNewContext(...args);
        await instrumentContext(context);
        return context;
      };
    }
    await use(browser);
  },

  context: async ({ context }, use, testInfo) => {
    await instrumentContext(context);
    await use(context);

    const tracked = armedByContext.get(context);
    const fromProbe = tracked?.sources ?? new Set<string>();
    const mutated = tracked?.mutated ?? new Set<string>();
    const sweep = injecting
      ? await readSentinel(context)
      : { armed: false, mutated: null };
    if (sweep.armed) {
      fromProbe.add('teardown-sweep');
      if (sweep.mutated !== null) mutated.add(sweep.mutated);
    }
    // 'true' wins over 'false'/'unknown': the fault fires once per context, and a later
    // page that never saw the flag must not erase an observed mutation.
    const mutationApplied = mutated.has('true')
      ? true
      : mutated.has('false')
        ? false
        : null;
    record({
      file: testInfo.file,
      title: testInfo.titlePath.join(' > '),
      test_id: testInfo.testId,
      status: testInfo.status,
      injecting,
      armed: fromProbe.size > 0,
      sources: Array.from(fromProbe),
      mutation_applied: mutationApplied,
      bug_script: BUG_SCRIPT_PATH,
    });
  },

  page: async ({ page }, use) => {
    await armLoadedPage(page);
    await use(page);
  },
});
