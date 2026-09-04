import { test, expect } from '@playwright/test';

test.use({
  launchOptions: {
    args: ['--disable-web-security'],
  },
});

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/signin');
  await page.locator('input[name="username"]').fill('Heath93');
  await page.locator('input[name="password"]').fill('s3cret');
  await page.locator('[data-test="signin-submit"]').click();
  await page.waitForURL('**/');
}

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

    await page.locator('input[name="bankName"]').fill('Playwright Test Bank');
    await page.locator('input[name="routingNumber"]').fill('987654321');
    await page.locator('input[name="accountNumber"]').fill('123456789');

    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeEnabled();
    await page.locator('[data-test="bankaccount-submit"]').click();

    // Postconditions
    await expect(page).toHaveURL(/\/bankaccounts/);
    await expect(page.locator('[data-test="bankaccount-list"]')).toContainText('Playwright Test Bank');
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: 'Playwright Test Bank' }).first()
    ).toBeVisible();
    // Ensure it does NOT show "(Deleted)"
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: 'Playwright Test Bank' }).first()
    ).not.toContainText('(Deleted)');
  });

  // NOTE: 2.3 depends on 2.2 having created "Playwright Test Bank" — runs after 2.2
  test('2.3 Delete an existing bank account and verify it is marked deleted', async ({ page }) => {
    await signIn(page);

    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await expect(page).toHaveURL(/\/bankaccounts/);

    // Count delete buttons before deletion
    const deleteButtons = page.locator('[data-test="bankaccount-delete"]');
    const initialCount = await deleteButtons.count();

    // Find the "Playwright Test Bank" item and click its delete button
    const playwrightBankItem = page
      .locator('[data-test^="bankaccount-list-item-"]')
      .filter({ hasText: 'Playwright Test Bank' })
      .first();
    await expect(playwrightBankItem).toBeVisible();
    await playwrightBankItem.locator('[data-test="bankaccount-delete"]').click();

    // Wait for deletion to complete
    await page.waitForTimeout(500);

    // Postconditions
    // Item now shows "(Deleted)"
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: 'Playwright Test Bank (Deleted)' }).first()
    ).toBeVisible();
    // The deleted item no longer has a delete button
    await expect(
      page
        .locator('[data-test^="bankaccount-list-item-"]')
        .filter({ hasText: 'Playwright Test Bank (Deleted)' })
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
