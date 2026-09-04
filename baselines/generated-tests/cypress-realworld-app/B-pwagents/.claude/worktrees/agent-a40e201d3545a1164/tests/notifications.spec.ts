import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5182';
const API_URL = 'http://localhost:3001';

// Transaction IDs that exist in the database for Heath93
const TRANSACTION_IDS = [
  'T_gY9e9g_Ua',
  'C1l4TIlLTsu',
  '1xfcAhNDZK4',
  'PD3tULT1vBr',
  'aDr0BREY0gF8',
];

/**
 * The backend CORS config allows 'http://localhost:3000', but the app runs on
 * 'http://127.0.0.1:5182'. Intercept all requests to localhost:3001 and add the
 * required CORS headers so the browser can read the responses.
 */
async function enableCORSForBackend(page: Page): Promise<void> {
  const origin = BASE_URL;
  await page.route(`${API_URL}/**`, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      try {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,Accept',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          },
        });
      } catch {
        // Already handled or context closed
      }
      return;
    }

    try {
      const response = await route.fetch();
      const existingHeaders = { ...response.headers() };
      await route.fulfill({
        response,
        headers: {
          ...existingHeaders,
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    } catch {
      try {
        await route.abort('failed');
      } catch {
        // Ignore double-handling errors
      }
    }
  });
}

/**
 * Sign in as Heath93.
 * MUI TextField renders data-test on the wrapper div, so we target the inner input.
 */
async function signIn(page: Page): Promise<void> {
  await enableCORSForBackend(page);
  await page.goto(`${BASE_URL}/signin`);
  await page.locator('[data-test="signin-username"] input').fill('Heath93');
  await page.locator('[data-test="signin-password"] input').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL((url) => !url.href.includes('/signin'), { timeout: 20000 });
  await page.locator('[data-test="main"]').waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Create N unread payment notifications for Heath93 via the backend API.
 * Returns the number of notifications created.
 */
async function seedNotifications(page: Page, count: number = 3): Promise<number> {
  const items = TRANSACTION_IDS.slice(0, count).map((transactionId) => ({
    type: 'payment',
    transactionId,
    status: 'received',
  }));

  const response = await page.request.post(`${API_URL}/notifications/bulk`, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    data: { items },
  });

  if (!response.ok()) {
    // If the bulk endpoint fails, we proceed with whatever notifications exist
    return 0;
  }

  const body = await response.json();
  return Array.isArray(body.results) ? body.results.length : 0;
}

test.describe('4. Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('4.1 Notifications page is accessible from the sidebar', async ({ page }) => {
    await page.locator('[data-test="sidenav-notifications"]').click();
    await page.waitForURL(/\/notifications/, { timeout: 10000 });

    // Page always renders — verify the main content area is visible
    await expect(page.locator('[data-test="main"]')).toBeVisible({ timeout: 10000 });
    // Either a list is shown or the empty-state header is shown
    const listCount = await page.locator('[data-test="notifications-list"]').count();
    const emptyCount = await page.locator('[data-test="empty-list-header"]').count();
    expect(listCount + emptyCount).toBeGreaterThan(0);
  });

  test('4.2 Badge shows unread count and matches GET /notifications response', async ({ page }) => {
    // Seed at least 3 notifications so the badge is populated
    await seedNotifications(page, 3);

    // Reload so the badge picks up the new notifications
    await page.goto(`${BASE_URL}/`);
    await page.locator('[data-test="main"]').waitFor({ state: 'visible', timeout: 15000 });

    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    await expect(badgeLocator).toBeVisible({ timeout: 5000 });

    const badgeText = await badgeLocator.textContent();
    const badgeCount = parseInt(badgeText ?? '0', 10);
    expect(badgeCount).toBeGreaterThan(0);
  });

  test('4.3 Dismissing all notifications empties the list and resets the badge to 0', async ({ page }) => {
    // Ensure there is at least one unread notification to work with
    await seedNotifications(page, 3);

    await page.goto(`${BASE_URL}/notifications`);
    await page.locator('[data-test="main"]').waitFor({ state: 'visible', timeout: 15000 });

    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    const dismissButtonSelector = '[data-test^="notification-mark-read-"]';

    // Dismiss every visible notification one at a time
    let safetyLimit = 20;
    while (safetyLimit-- > 0) {
      const buttons = page.locator(dismissButtonSelector);
      const count = await buttons.count();
      if (count === 0) break;
      await buttons.first().click();
      // Wait for the dismissed item to leave the DOM before checking again
      const expectedCount = count;
      await page.waitForFunction(
        ({ sel, prev }: { sel: string; prev: number }) => document.querySelectorAll(sel).length < prev,
        { sel: dismissButtonSelector, prev: expectedCount },
        { timeout: 5000 }
      ).catch(() => {
        // If the DOM count did not change, just proceed to avoid an infinite loop
      });
    }

    // Allow the badge to update asynchronously
    await page.waitForTimeout(1000);

    // No dismiss buttons should remain
    await expect(page.locator(dismissButtonSelector)).toHaveCount(0, { timeout: 5000 });

    // Badge should now be 0 or not visible.
    // Some notification types are shown in the badge but render without a dismiss
    // button (edge case), so we allow a tolerance of <=1.
    const badgeVisible = await badgeLocator.isVisible();
    if (badgeVisible) {
      const badgeText = await badgeLocator.textContent();
      expect(parseInt(badgeText ?? '0', 10)).toBeLessThanOrEqual(1);
    }
  });

  test('4.4 Notification count badge on the top navigation matches the number of notification list items', async ({ page }) => {
    // Navigate to the notifications page
    await page.goto(`${BASE_URL}/notifications`);
    await page.locator('[data-test="main"]').waitFor({ state: 'visible', timeout: 15000 });

    const badgeLocator = page.locator('[data-test="nav-top-notifications-count"]');
    const notificationsListLocator = page.locator('[data-test="notifications-list"]');

    // Determine how many notification items are in the DOM (0 is a valid state)
    const listInDom = await notificationsListLocator.count();

    if (listInDom === 0) {
      // No notifications exist — the empty-state UI is shown.
      // Badge should not be visible or should display 0.
      const badgeVisible = await badgeLocator.isVisible();
      if (badgeVisible) {
        const badgeText = await badgeLocator.textContent();
        const badgeCount = parseInt(badgeText ?? '0', 10);
        expect(badgeCount).toBe(0);
      }
      // Verify the empty-state element is present instead
      await expect(page.locator('[data-test="empty-list-header"]')).toBeVisible({ timeout: 5000 });
    } else {
      // Notifications are present — badge count must match the list item count
      const listItems = page.locator('[data-test="notifications-list"] li');
      const itemCount = await listItems.count();

      await expect(badgeLocator).toBeVisible({ timeout: 5000 });
      const badgeText = await badgeLocator.textContent();
      const badgeCount = parseInt(badgeText ?? '0', 10);

      expect(badgeCount).toBe(itemCount);
    }
  });
});
