import { test, expect } from '@playwright/test';

/**
 * Transaction Detail area — scenarios 5.1 through 5.4
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

/** Log in and navigate to the first transaction detail page, returning its ID. */
async function goToFirstTransactionDetail(page: any): Promise<string> {
  await login(page);

  const firstItem = page.locator('[data-test^="transaction-item-"]').first();
  await expect(firstItem).toBeVisible();

  const itemAttr = await firstItem.getAttribute('data-test');
  const txId = itemAttr?.replace('transaction-item-', '') ?? '';

  await firstItem.click();
  await page.waitForURL(`**/transaction/${txId}`);
  await page.waitForTimeout(500);

  return txId;
}

test.describe('Transaction Detail', () => {
  // -------------------------------------------------------------------------
  // 5.1 — Clicking a transaction navigates to its detail page
  // -------------------------------------------------------------------------
  test('5.1 clicking a transaction item opens the detail page', async ({ page }) => {
    const txId = await goToFirstTransactionDetail(page);

    await expect(page).toHaveURL(new RegExp(`/transaction/${txId}`));
    await expect(page.locator('[data-test="transaction-detail-header"]')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5.2 — Detail page renders the key transaction information
  // -------------------------------------------------------------------------
  test('5.2 detail page shows sender, receiver, action, and amount', async ({ page }) => {
    const txId = await goToFirstTransactionDetail(page);

    // Avatars
    await expect(page.locator('[data-test="transaction-sender-avatar"]')).toBeVisible();
    await expect(page.locator('[data-test="transaction-receiver-avatar"]')).toBeVisible();

    // Sender, action verb (paid / charged), receiver
    await expect(page.locator(`[data-test="transaction-sender-${txId}"]`)).toBeVisible();
    await expect(page.locator(`[data-test="transaction-action-${txId}"]`)).toBeVisible();
    await expect(page.locator(`[data-test="transaction-receiver-${txId}"]`)).toBeVisible();

    // Description text and amount
    await expect(page.locator('[data-test="transaction-description"]')).toBeVisible();
    await expect(page.locator(`[data-test="transaction-amount-${txId}"]`)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5.3 — Like button is present and like count is displayed
  // -------------------------------------------------------------------------
  test('5.3 like button and like count are visible on detail page', async ({ page }) => {
    const txId = await goToFirstTransactionDetail(page);

    const likeBtn = page.locator(`[data-test="transaction-like-button-${txId}"]`);
    const likeCount = page.locator(`[data-test="transaction-like-count-${txId}"]`);

    await expect(likeBtn).toBeVisible();
    await expect(likeCount).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5.4 — Comment input field is present on the detail page
  // -------------------------------------------------------------------------
  test('5.4 comment input field is present on the detail page', async ({ page }) => {
    const txId = await goToFirstTransactionDetail(page);

    const commentInput = page.locator(`[data-test="transaction-comment-input-${txId}"]`);
    await expect(commentInput).toBeVisible();
  });
});
