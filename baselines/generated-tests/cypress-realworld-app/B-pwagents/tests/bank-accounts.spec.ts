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

// Unique bank name shared between 2.2 (create) and 2.3 (delete)
const TEST_BANK_NAME = `PW Test Bank ${Date.now()}`;

test.describe('Area 2: Bank Accounts', () => {
  test('2.1 Bank accounts page displays existing accounts', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await expect(page).toHaveURL(/\/bankaccounts/);

    // Postconditions
    await expect(page.locator('[data-test="bankaccount-list"]')).toBeVisible();
    await expect(page.locator('[data-test^="bankaccount-list-item-"]').first()).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-new"]')).toBeVisible();
  });

  test('2.2 Create a new bank account with valid bank name, routing number, and account number', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await expect(page).toHaveURL(/\/bankaccounts/);

    await page.locator('[data-test="bankaccount-new"]').click();
    await expect(page).toHaveURL(/\/bankaccounts\/new/);
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible();

    await page.locator('input[name="bankName"]').fill(TEST_BANK_NAME);
    await page.locator('input[name="routingNumber"]').fill('987654321');
    await page.locator('input[name="accountNumber"]').fill('123456789');

    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeEnabled();
    await page.locator('[data-test="bankaccount-submit"]').click();

    // Postconditions
    await expect(page).toHaveURL(/\/bankaccounts/);
    await expect(page.locator('[data-test="bankaccount-list"]')).toContainText(TEST_BANK_NAME);
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: TEST_BANK_NAME }).first()
    ).toBeVisible();
    // Ensure it does NOT show "(Deleted)"
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: TEST_BANK_NAME }).first()
    ).not.toContainText('(Deleted)');
  });

  // NOTE: 2.3 depends on 2.2 having created TEST_BANK_NAME — runs after 2.2
  test('2.3 Delete an existing bank account and verify it is marked deleted', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await expect(page).toHaveURL(/\/bankaccounts/);

    // Count delete buttons before deletion
    const deleteButtons = page.locator('[data-test="bankaccount-delete"]');
    const initialCount = await deleteButtons.count();

    // Find the bank created in 2.2 and click its delete button
    const playwrightBankItem = page
      .locator('[data-test^="bankaccount-list-item-"]')
      .filter({ hasText: TEST_BANK_NAME })
      .first();
    await expect(playwrightBankItem).toBeVisible();
    await playwrightBankItem.locator('[data-test="bankaccount-delete"]').click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // Postconditions
    // Item now shows "(Deleted)"
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: `${TEST_BANK_NAME} (Deleted)` }).first()
    ).toBeVisible();
    // The deleted item no longer has a delete button
    await expect(
      page
        .locator('[data-test^="bankaccount-list-item-"]')
        .filter({ hasText: `${TEST_BANK_NAME} (Deleted)` })
        .first()
        .locator('[data-test="bankaccount-delete"]')
    ).toHaveCount(0);
    // Total delete button count decreased by 1
    const finalCount = await deleteButtons.count();
    expect(finalCount).toBe(initialCount - 1);
  });

  test('2.4 Save button is disabled and errors shown when bank account form fields are empty', async ({ page }) => {
    await signIn(page);

    await page.goto('/bankaccounts/new');
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible();

    // Tab through all fields to trigger blur validation
    await page.locator('input[name="bankName"]').click();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check error messages are displayed
    await expect(page.locator('.MuiFormHelperText-root').filter({ hasText: 'Enter a bank name' })).toBeVisible();
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Enter a valid bank routing number' })
    ).toBeVisible();
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Enter a valid bank account number' })
    ).toBeVisible();

    // Submit button should be disabled
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeDisabled();
  });

  test('2.5 Error shown when routing number has fewer than 9 digits', async ({ page }) => {
    await signIn(page);

    await page.goto('/bankaccounts/new');
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible();

    await page.locator('input[name="bankName"]').fill('Test Bank');
    await page.locator('input[name="routingNumber"]').fill('12345678'); // 8 digits — too short
    await page.locator('input[name="accountNumber"]').fill('123456789');
    // Blur the routing number field by clicking bank name
    await page.locator('input[name="bankName"]').click();

    // Postconditions
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Must contain a valid routing number' })
    ).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeDisabled();

    // Fix it with a valid 9-digit routing number
    await page.locator('input[name="routingNumber"]').fill('123456789');
    await page.locator('input[name="bankName"]').click();
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeEnabled();
  });

  test('2.6 Error shown when account number has fewer than 9 digits', async ({ page }) => {
    await signIn(page);

    await page.goto('/bankaccounts/new');
    await expect(page.locator('[data-test="bankaccount-form"]')).toBeVisible();

    await page.locator('input[name="bankName"]').fill('Test Bank');
    await page.locator('input[name="routingNumber"]').fill('123456789'); // valid
    await page.locator('input[name="accountNumber"]').fill('12345678'); // 8 digits — too short
    // Blur the account number field by clicking bank name
    await page.locator('input[name="bankName"]').click();

    // Postconditions
    await expect(
      page.locator('.MuiFormHelperText-root').filter({ hasText: 'Must contain at least 9 digits' })
    ).toBeVisible();
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeDisabled();

    // Fix it with a valid 9-digit account number
    await page.locator('input[name="accountNumber"]').fill('123456789');
    await page.locator('input[name="bankName"]').click();
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeEnabled();
  });
});
