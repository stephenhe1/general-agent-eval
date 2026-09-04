import { test, expect } from '@playwright/test';

async function setupCORSProxy(page: import('@playwright/test').Page) {
  await page.route('http://localhost:3001/**', async (route) => {
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
      headers['access-control-allow-origin'] = request.headers()['origin'] || 'http://127.0.0.1:5182';
      headers['access-control-allow-credentials'] = 'true';
      await route.fulfill({ status: response.status(), headers, body });
    } catch {
      await route.abort();
    }
  });
}

async function signIn(page: import('@playwright/test').Page) {
  await setupCORSProxy(page);
  await page.goto('/signin');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="username"]').fill('Heath93');
  await page.locator('input[name="password"]').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
  await page.waitForTimeout(500);
}

test.describe('Area 1: New Transaction', () => {
  test('1.1 Send payment — user search, amount, note, confirm', async ({ page }) => {
    await signIn(page);

    // Get current balance text to compare after payment
    const balanceLocator = page.locator('[data-test="sidenav-user-balance"]');
    const initialBalance = await balanceLocator.textContent();

    // Step 1: Click New Transaction button
    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page).toHaveURL(/\/transaction\/new/);

    // Step 3: Assert step 1 indicator
    await expect(page.getByText('Select Contact')).toBeVisible();

    // Step 4: Assert users list is visible
    await expect(page.locator('[data-test="users-list"]')).toBeVisible();

    // Step 5-7: Search for Darrel
    await page.locator('[data-test="user-list-search-input"]').fill('Darrel');
    await expect(page.locator('[data-test="user-list-item-_XblMqbuoP"]')).toBeVisible();

    // Step 8: Select Darrel Ortiz
    await page.locator('[data-test="user-list-item-_XblMqbuoP"]').click();

    // Step 9: Assert form is visible
    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible();

    // Steps 10-11: Buttons disabled initially
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeDisabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeDisabled();

    // Steps 12-13: Fill amount and description
    await page.locator('input[name="amount"]').fill('25');
    await page.locator('input[name="description"]').fill('Lunch split');

    // Steps 14-15: Buttons now enabled
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeEnabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeEnabled();

    // Step 16: Submit payment
    await page.locator('[data-test="transaction-create-submit-payment"]').click();

    // Postconditions
    await expect(page.locator('[data-test="alert-bar-success"]')).toBeVisible();
    await expect(page.locator('[data-test="alert-bar-success"]')).toContainText('Transaction Submitted!');
    await expect(page.locator('[data-test="main"]')).toContainText('Paid $25.00 for Lunch split');
    await expect(page.locator('[data-test="new-transaction-return-to-transactions"]')).toBeVisible();
    await expect(page.locator('[data-test="new-transaction-create-another-transaction"]')).toBeVisible();

    // Balance decreased
    const updatedBalance = await balanceLocator.textContent();
    expect(updatedBalance).not.toEqual(initialBalance);

    // Navigate to personal tab and verify transaction appears
    await page.locator('[data-test="new-transaction-return-to-transactions"]').click();
    await page.locator('[data-test="nav-personal-tab"]').click();
    await expect(page.locator('[data-test="transaction-list"]').first()).toBeVisible();
  });

  test('1.2 Request payment — select user, fill amount and note, submit request', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page).toHaveURL(/\/transaction\/new/);

    // Select Darrel Ortiz (no search needed, just click)
    await expect(page.locator('[data-test="user-list-item-_XblMqbuoP"]')).toBeVisible();
    await page.locator('[data-test="user-list-item-_XblMqbuoP"]').click();

    // Assert form is visible
    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible();

    // Fill fields
    await page.locator('input[name="amount"]').fill('50');
    await page.locator('input[name="description"]').fill('Rent share');

    // Submit request
    await page.locator('[data-test="transaction-create-submit-request"]').click();

    // Postconditions
    await expect(page.locator('[data-test="alert-bar-success"]')).toBeVisible();
    await expect(page.locator('[data-test="alert-bar-success"]')).toContainText('Transaction Submitted!');
    await expect(page.locator('[data-test="main"]')).toContainText('Requested $50.00 for Rent share');
    await expect(page.locator('[data-test="new-transaction-return-to-transactions"]')).toBeVisible();

    // Navigate to personal tab and verify transaction appears
    await page.locator('[data-test="new-transaction-return-to-transactions"]').click();
    await page.locator('[data-test="nav-personal-tab"]').click();
    await expect(page.locator('[data-test="transaction-list"]').first()).toBeVisible();
  });

  test('1.3 Use "Create Another Transaction" button to start a new transaction immediately', async ({ page }) => {
    await signIn(page);

    // Complete a send transaction first
    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page.locator('[data-test="user-list-item-_XblMqbuoP"]')).toBeVisible();
    await page.locator('[data-test="user-list-item-_XblMqbuoP"]').click();
    await page.locator('input[name="amount"]').fill('10');
    await page.locator('input[name="description"]').fill('Test payment');
    await page.locator('[data-test="transaction-create-submit-payment"]').click();
    await expect(page.locator('[data-test="alert-bar-success"]')).toBeVisible();

    // Click "Create Another Transaction"
    await page.locator('[data-test="new-transaction-create-another-transaction"]').click();

    // Postconditions
    await expect(page).toHaveURL(/\/transaction\/new/);
    await expect(page.locator('[data-test="users-list"]')).toBeVisible();
  });

  test('1.4 Pay/Request buttons remain disabled until both amount and description are filled', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page.locator('[data-test="user-list-item-_XblMqbuoP"]')).toBeVisible();
    await page.locator('[data-test="user-list-item-_XblMqbuoP"]').click();
    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible();

    // Both buttons disabled initially
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeDisabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeDisabled();

    // Fill amount only — buttons still disabled
    await page.locator('input[name="amount"]').fill('10');
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeDisabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeDisabled();

    // Clear amount, fill description only — buttons still disabled
    await page.locator('input[name="amount"]').clear();
    await page.locator('input[name="description"]').fill('test note');
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeDisabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeDisabled();

    // Fill both — buttons now enabled
    await page.locator('input[name="amount"]').fill('10');
    await expect(page.locator('[data-test="transaction-create-submit-payment"]')).toBeEnabled();
    await expect(page.locator('[data-test="transaction-create-submit-request"]')).toBeEnabled();
  });

  test('1.5 User search returns no results when no contacts match the query', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page.locator('[data-test="users-list"]')).toBeVisible();

    // Type a query that matches no user
    await page.locator('[data-test="user-list-search-input"]').fill('XXXXXXNONEXISTENTUSER');

    // Wait for search to debounce/execute
    await page.waitForTimeout(500);

    // No user items should be visible
    await expect(page.locator('[data-test^="user-list-item-"]')).toHaveCount(0);
  });

  test('1.6 Return to transactions list via the "Return To Transactions" button', async ({ page }) => {
    await signIn(page);

    // Complete a payment to reach the confirmation page
    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await expect(page.locator('[data-test="user-list-item-_XblMqbuoP"]')).toBeVisible();
    await page.locator('[data-test="user-list-item-_XblMqbuoP"]').click();
    await page.locator('input[name="amount"]').fill('5');
    await page.locator('input[name="description"]').fill('Return test');
    await page.locator('[data-test="transaction-create-submit-payment"]').click();
    await expect(page.locator('[data-test="new-transaction-return-to-transactions"]')).toBeVisible();

    // Click Return To Transactions
    await page.locator('[data-test="new-transaction-return-to-transactions"]').click();

    // Postconditions
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:5182\/?$/);
    await expect(page.locator('[data-test="nav-transaction-tabs"]')).toBeVisible();
  });
});
