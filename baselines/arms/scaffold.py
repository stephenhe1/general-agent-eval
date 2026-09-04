#!/usr/bin/env python3
"""Build the two sanitized Playwright workspaces for one subject.

Mirrors general_agent_eval.webtestpilot.workspace for apps that are not in its APPS
registry: same package.json, same config (1280x720, serial, no retries), same
APP_NOTES shape. Arm B additionally gets tests/seed.spec.ts, which is setup only.
"""
import json, sys
from pathlib import Path

W, H = 1280, 720
PKG = {"name": "baseline-suite", "private": True, "version": "0.0.0",
       "description": "Playwright end-to-end test project.",
       "scripts": {"test": "playwright test"},
       "devDependencies": {"@playwright/test": "^1.49.0"}}

CONFIG = """import {{ defineConfig, devices }} from '@playwright/test';

export default defineConfig({{
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  timeout: 60_000,
  use: {{
    baseURL: process.env.PLAYWRIGHT_BASE_URL || '{url}',
    viewport: {{ width: {w}, height: {h} }},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  }},
  projects: [
    {{ name: 'chromium', use: {{ ...devices['Desktop Chrome'], viewport: {{ width: {w}, height: {h} }} }} }},
  ],
}});
"""

NOTES = """# {title} - application under test

A running instance is available at {url}. It is already built, seeded, and started;
do not attempt to build, start, stop, or reconfigure it.

This project directory contains no application source. The UI is a black box:
discover its pages, flows, and behaviour by navigating the live instance.

{notes}

## Accounts

{accounts}

## Data

You may create, edit, and delete data freely while exploring and while your tests run.

## Viewport

Tests are executed at {w}x{h}.
"""

FACTS = {
 "todomvc": ("TodoMVC", "A classic todo application. All state persists in one browser localStorage key; there is no backend and no sign-in.", "_No accounts; the application has no authentication._", ""),
 "keystone-blog": ("Keystone blog", "The Keystone 6 Admin UI over three lists: Author, Post and Tag. Mutations go through GraphQL to Prisma/SQLite. There is no authentication, so the whole surface is reachable without a session.", "_No accounts; this example has no authentication._", ""),
 "bangle-io": ("Bangle.io", "A browser-local note application. Notes persist in IndexedDB via the File System Access API; there is no backend and no sign-in. The workspace entry point is /ws#route=ws-home&wsName=ugx-baseline .", "_No accounts; the application has no authentication._", ""),
 "epic-stack": ("Epic Stack", "A full-stack React Router application with server-side persistence (Prisma/SQLite). Users own notes with images; profile and password settings live under /settings/profile.", "- **user** - username `kody`, password `kodylovesyou`", """  await page.goto('/login');
  await page.getByRole('textbox', { name: /username/i }).fill('kody');
  await page.getByLabel(/password/i).fill('kodylovesyou');
  await page.getByRole('button', { name: /log ?in/i }).click();
  await page.waitForLoadState('domcontentloaded');"""),
 "cypress-realworld-app": ("Cypress Real World App", "A payment application with a REST backend (Express + lowdb). Users send and request money, comment on and like transactions, and manage bank accounts. Sign in first; the API runs on port 3001.", "- **user** - username `{RWA_USER}`, password `s3cret`", """  await page.goto('/signin');
  await page.getByLabel(/username/i).fill('{RWA_USER}');
  await page.getByLabel(/password/i).fill('s3cret');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForLoadState('domcontentloaded');"""),
}

SEED = """import {{ test }} from '@playwright/test';

/**
 * Seed test for the Playwright test agents: runs whatever initialization the app needs and
 * leaves the browser on a usable page. Asserts nothing; excluded from the evaluated suite.
 */
test('seed', async ({{ page }}) => {{
{body}
}});
"""

def rwa_user() -> str:
    db = Path("/Users/stephenhe/Projects/new-benchmark-repos/cypress-realworld-app/data/database.json")
    try:
        return json.loads(db.read_text())["users"][0]["username"]
    except Exception:
        return "Katharina_Bernier"

def main(subject: str, url: str, root: str) -> None:
    title, notes, accounts, seed_body = FACTS[subject]
    user = rwa_user()
    accounts = accounts.replace("{RWA_USER}", user)
    seed_body = seed_body.replace("{RWA_USER}", user)
    for arm in ("A-naive", "B-pwagents"):
        d = Path(root) / subject / arm
        d.mkdir(parents=True, exist_ok=True)
        (d / "package.json").write_text(json.dumps(PKG, indent=2) + "\n")
        (d / "playwright.config.ts").write_text(CONFIG.format(url=url, w=W, h=H))
        (d / "APP_NOTES.md").write_text(NOTES.format(title=title, url=url, notes=notes,
                                                     accounts=accounts, w=W, h=H))
        (d / ".gitignore").write_text("node_modules/\nplaywright-report/\ntest-results/\n")
        if arm == "B-pwagents":
            body = seed_body or "  await page.goto('/');\n  await page.waitForLoadState('domcontentloaded');"
            (d / "tests").mkdir(exist_ok=True)
            (d / "tests" / "seed.spec.ts").write_text(SEED.format(body=body))
    print(f"[scaffold] {subject}: A-naive + B-pwagents ready at {url}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
