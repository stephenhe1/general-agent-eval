import { test, expect } from '@playwright/test';

/**
 * Dashboard area — scenarios 3.1 through 3.2
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

test.describe('Dashboard', () => {
  // -------------------------------------------------------------------------
  // 3.1 — Dashboard renders the main layout after login
  // -------------------------------------------------------------------------
  test('3.1 dashboard shows sidenav, transaction tabs and transaction list', async ({ page }) => {
    await login(page);

    // Sidenav with user info
    await expect(page.locator('[data-test="sidenav"]')).toBeVisible();
    await expect(page.locator('[data-test="sidenav-username"]')).toContainText('Heath93');
    await expect(page.locator('[data-test="sidenav-user-balance"]')).toBeVisible();

    // Navigation tabs are shown
    await expect(page.locator('[data-test="nav-transaction-tabs"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-public-tab"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-contacts-tab"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-personal-tab"]')).toBeVisible();

    // Transaction list is rendered with at least one item
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible();
    await expect(page.locator('[data-test^="transaction-item-"]').first()).toBeVisible();

    // Top nav actions are present
    await expect(page.locator('[data-test="nav-top-new-transaction"]')).toBeVisible();
    await expect(page.locator('[data-test="nav-top-notifications-link"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3.2 — Unauthenticated access to dashboard redirects to sign-in
  // -------------------------------------------------------------------------
  test('3.2 unauthenticated access to "/" redirects to sign-in', async ({ page }) => {
    // Do NOT set up CORS proxy or log in — navigate directly
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Should be on the sign-in page
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.locator('[data-test="signin-submit"]')).toBeVisible();
  });
});
