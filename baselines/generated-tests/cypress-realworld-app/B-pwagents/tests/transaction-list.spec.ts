import { test, expect } from '@playwright/test';

/**
 * Transaction List Tabs area — scenarios 4.1 through 4.6
 */

async function setupCORSProxy(page: any) {
  await page.route('http://localhost:3001/**', async (route: any) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': request.headers()['origin'] || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        },
        body: '',
      });
    }
    try {
      const response = await route.fetch();
      const body = await response.body();
      const headers = response.headers();
      headers['access-control-allow-origin'] =
        request.headers()['origin'] || 'http://127.0.0.1:5182';
      headers['access-control-allow-credentials'] = 'true';
      await route.fulfill({ status: response.status(), headers, body });
    } catch {
      await route.abort();
    }
  });
}

async function login(page: any) {
  await setupCORSProxy(page);
  await page.goto('/signin');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="username"]').fill('Heath93');
  await page.locator('input[name="password"]').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
  await page.waitForTimeout(500);
}

test.describe('Transaction List Tabs', () => {
  // -------------------------------------------------------------------------
  // 4.1 — Public tab is the default and shows transactions
  // -------------------------------------------------------------------------
  test('4.1 public tab is active by default and displays transactions', async ({ page }) => {
    await login(page);

    // Public tab selected by default
    await expect(page.locator('[data-test="nav-public-tab"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-transaction-tabs"]')).toBeVisible();

    // Transaction list is populated
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible();
    const items = page.locator('[data-test^="transaction-item-"]');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4.2 — Contacts tab navigates to /contacts
  // -------------------------------------------------------------------------
  test('4.2 contacts tab navigates to /contacts and shows a list', async ({ page }) => {
    await login(page);

    await page.locator('[data-test="nav-contacts-tab"]').click();
    await expect(page).toHaveURL(/\/contacts/);

    // The list container is present (may be empty or populated)
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4.3 — Personal tab navigates to /personal
  // -------------------------------------------------------------------------
  test('4.3 personal tab navigates to /personal and shows transactions', async ({ page }) => {
    await login(page);

    await page.locator('[data-test="nav-personal-tab"]').click();
    await expect(page).toHaveURL(/\/personal/);

    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible();
    const items = page.locator('[data-test^="transaction-item-"]');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4.4 — Each transaction item shows sender, receiver, and amount
  // -------------------------------------------------------------------------
  test('4.4 transaction list items display sender, receiver, and amount', async ({ page }) => {
    await login(page);

    // Get the first transaction's ID suffix from its data-test attribute
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible();

    const itemAttr = await firstItem.getAttribute('data-test');
    const txId = itemAttr?.replace('transaction-item-', '') ?? '';
    expect(txId.length).toBeGreaterThan(0);

    // Sender, receiver, and amount are rendered for that item
    await expect(page.locator(`[data-test="transaction-sender-${txId}"]`)).toBeVisible();
    await expect(page.locator(`[data-test="transaction-receiver-${txId}"]`)).toBeVisible();
    await expect(page.locator(`[data-test="transaction-amount-${txId}"]`)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4.5 — Date range filter button opens the filter panel
  // -------------------------------------------------------------------------
  test('4.5 date range filter button opens the date filter panel', async ({ page }) => {
    await login(page);

    const filterBtn = page.locator('[data-test="transaction-list-filter-date-range-button"]');
    await expect(filterBtn).toBeVisible();

    await filterBtn.click();
    await page.waitForTimeout(300);

    // Filter panel becomes visible
    await expect(
      page.locator('[data-test="transaction-list-filter-date-range"]')
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4.6 — Amount range filter button opens the amount filter panel
  // -------------------------------------------------------------------------
  test('4.6 amount range filter button opens the amount filter panel', async ({ page }) => {
    await login(page);

    const filterBtn = page.locator('[data-test="transaction-list-filter-amount-range-button"]');
    await expect(filterBtn).toBeVisible();

    await filterBtn.click();
    await page.waitForTimeout(300);

    // Filter panel and slider become visible
    await expect(
      page.locator('[data-test="transaction-list-filter-amount-range"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-test="transaction-list-filter-amount-range-slider"]')
    ).toBeVisible();
  });
});
