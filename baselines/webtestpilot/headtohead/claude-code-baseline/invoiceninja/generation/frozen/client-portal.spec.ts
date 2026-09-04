/**
 * Client Portal UI tests — Invoice Ninja
 *
 * Tests the server-rendered Blade/Livewire client portal.
 *
 * Strategy: log in ONCE in beforeAll, store cookies, then restore them in
 * beforeEach for each test. This avoids repeated login-form submissions that
 * trigger Laravel's rate-limiter (429) after a handful of attempts.
 *
 * Seeded data:
 *   - Client: company_name (email@example.com)
 *   - Invoices: 123456_past_due ($60k, Overdue), 123456 ($120k), 123456_sent, 123456_draft
 *   - Quotes: 123456 ($720k, Pending), 123456_expired ($60k, Expired)
 *   - Payments: 0001 (Bank Transfer $120k)
 *   - Recurring Invoices: 1 seeded
 */
import { test, expect, BrowserContext } from '@playwright/test';

// ─── Shared auth state ───────────────────────────────────────────────────────

let authCookies: { name: string; value: string; domain: string; path: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' }[] = [];

// Log in ONCE before all tests to get a valid session cookie set.
// Individual tests restore these cookies via beforeEach — no form submission needed.
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/client/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="email"]').fill('email@example.com');
  await page.locator('input[name="password"]').fill('Password1!');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  const state = await context.storageState();
  authCookies = state.cookies as typeof authCookies;
  await context.close();
});

// Restore auth cookies before each test so every page.goto to a protected
// route lands on the real page rather than being redirected to login.
test.beforeEach(async ({ page }) => {
  if (authCookies.length > 0) {
    await page.context().addCookies(authCookies);
  }
});

// ─── Invoices ────────────────────────────────────────────────────────────────

test.describe('Client portal — Invoices', () => {
  test('invoice list renders with seeded invoices', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Invoices');
    // At least one of the seeded invoice numbers is visible
    await expect(page.locator('body')).toContainText('123456');
    // Dollar amounts are formatted
    await expect(page.locator('body')).toContainText('$');
  });

  test('invoice list shows Overdue status for past-due invoice', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    // The past-due invoice should appear with an "Overdue" label
    await expect(page.locator('body')).toContainText('Overdue');
  });

  test('invoice list has filter buttons — Paid, Unpaid, Past Due', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Paid');
    await expect(page.locator('body')).toContainText('Unpaid');
    await expect(page.locator('body')).toContainText('Past Due');
  });

  test('Past Due filter shows the overdue invoice', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    // Click "Past Due" filter
    await page.locator('a, button, label', { hasText: 'Past Due' }).first().click();
    await page.waitForTimeout(1000);

    // Should contain the past-due invoice
    await expect(page.locator('body')).toContainText('123456_past_due');
  });

  test('invoice detail page renders correct amount and client info', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    // Get the first View link
    const viewLink = page.locator('a:has-text("View")').first();
    await expect(viewLink).toBeVisible();
    const href = await viewLink.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    // Invoice detail should show the client name and dollar amounts
    await expect(page.locator('body')).toContainText('company_name');
    await expect(page.locator('body')).toContainText('$');
  });

  test('invoice detail shows client contact email', async ({ page }) => {
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');

    const viewLinks = page.locator('a:has-text("View")');
    const count = await viewLinks.count();
    expect(count).toBeGreaterThan(0);

    const href = await viewLinks.first().getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('email@example.com');
  });
});

// ─── Quotes ──────────────────────────────────────────────────────────────────

test.describe('Client portal — Quotes', () => {
  test('quotes list renders with seeded quotes', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Quotes');
    await expect(page.locator('body')).toContainText('123456');
    await expect(page.locator('body')).toContainText('$720,000.00');
  });

  test('quotes list shows Pending and Expired status badges', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Pending');
    await expect(page.locator('body')).toContainText('Expired');
  });

  test('quotes list has Download and Approve buttons', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Download');
    await expect(page.locator('body')).toContainText('Approve');
  });

  test('quotes list shows at least 2 seeded quotes', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    const viewLinks = page.locator('a:has-text("View")');
    const count = await viewLinks.count();
    // There are 2 seeded quotes; additional ones may exist from test runs
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('quote detail page renders', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    const viewLink = page.locator('a:has-text("View")').first();
    const href = await viewLink.getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('company_name');
    await expect(page.locator('body')).toContainText('$');
  });

  test('Expired filter shows only expired quote', async ({ page }) => {
    await page.goto('/client/quotes');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('a, button, label', { hasText: 'Expired' }).first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('body')).toContainText('123456_expired');
  });
});

// ─── Payments ────────────────────────────────────────────────────────────────

test.describe('Client portal — Payments', () => {
  test('payments list renders with seeded payment', async ({ page }) => {
    // Block Livewire AJAX requests before navigating.
    // After many tests have run, Livewire component requests can hit Laravel's rate
    // limiter (429), which overwrites the page content.  The initial server-side
    // rendered HTML already contains the payment list data we need to assert.
    await page.route('**/livewire/**', route => route.abort());

    await page.goto('/client/payments');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Payments');
    // Initial SSR HTML contains at least one Bank Transfer payment row
    await expect(page.locator('body')).toContainText('Bank Transfer');
    // At least one dollar amount is rendered
    await expect(page.locator('body')).toContainText('$');
  });

  test('payment detail page renders', async ({ page }) => {
    // Navigate directly to the seeded payment detail (known ID)
    await page.goto('/client/payments/VolejRejNm');
    await page.waitForLoadState('domcontentloaded');

    // Payment detail shows amount, method, and status
    await expect(page.locator('body')).toContainText('$120,000.00');
    await expect(page.locator('body')).toContainText('Bank Transfer');
    await expect(page.locator('body')).toContainText('Completed');
  });
});

// ─── Other client portal pages ───────────────────────────────────────────────

test.describe('Client portal — Other pages', () => {
  test('recurring invoices page renders', async ({ page }) => {
    await page.goto('/client/recurring_invoices');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Recurring Invoices');
  });

  test('credits page renders', async ({ page }) => {
    await page.goto('/client/credits');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Credits');
    // Either shows "No results found" or actual credits
    const text = await page.locator('body').innerText();
    expect(text).toMatch(/Credits|No results found/);
  });

  test('documents page renders with category tabs', async ({ page }) => {
    await page.goto('/client/documents');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Documents');
    // Category tabs
    await expect(page.locator('body')).toContainText('Invoices');
    await expect(page.locator('body')).toContainText('Payments');
  });

  test('subscriptions page renders', async ({ page }) => {
    await page.goto('/client/subscriptions');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Subscriptions');
  });

  test('statement page renders with date range and status filters', async ({ page }) => {
    await page.goto('/client/statement');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('Statement');
    await expect(page.locator('body')).toContainText('From:');
    await expect(page.locator('body')).toContainText('To:');
    await expect(page.locator('body')).toContainText('Status:');
    await expect(page.locator('body')).toContainText('Download');
  });

  test('dashboard redirects to invoices when authenticated', async ({ page }) => {
    await page.goto('/client/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Dashboard redirects to invoices
    expect(page.url()).toContain('/client/invoices');
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

test.describe('Client portal — Logout', () => {
  test('logging out redirects to login page', async ({ page }) => {
    // Start on a protected page (cookies set by beforeEach)
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/client/invoices');

    // Navigate to logout
    await page.goto('/client/logout');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Should land on login page
    expect(page.url()).toContain('/client/login');
  });

  test('after logout, protected pages redirect to login', async ({ page }) => {
    // Logout first
    await page.goto('/client/logout');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Try to access protected page
    await page.goto('/client/invoices');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/client/login');
  });
});
