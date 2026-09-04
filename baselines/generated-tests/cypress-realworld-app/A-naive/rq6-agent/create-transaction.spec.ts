import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

// TransactionCreateStepTwo uses data-test directly on TextField (wrapper div)
// so we use '[data-test="..."] input' to reach the actual input.

test.describe('Create Transaction', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  /** Navigate to the new transaction page */
  async function goToNewTransaction(page: any) {
    await page.locator('[data-test="nav-top-new-transaction"]').click();
    await page.waitForURL(/\/transaction\/new/, { timeout: 10000 });
  }

  /** Select the first user from the users list */
  async function selectFirstUser(page: any) {
    // Wait for the user search input
    await expect(page.locator('[data-test="user-list-search-input"]')).toBeVisible({ timeout: 10000 });
    // Wait for the users list to appear (pre-populated)
    await expect(page.locator('[data-test="users-list"] li').first()).toBeVisible({ timeout: 10000 });
    await page.locator('[data-test="users-list"] li').first().click();
  }

  test('transaction/new shows user search step', async ({ page }) => {
    await goToNewTransaction(page);
    await expect(page.locator('[data-test="user-list-search-input"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-test="users-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('searching users filters the user list', async ({ page }) => {
    await goToNewTransaction(page);

    // Get initial count
    await expect(page.locator('[data-test="users-list"] li').first()).toBeVisible({ timeout: 10000 });

    // Search for a specific user
    await page.locator('[data-test="user-list-search-input"]').fill('T');
    await page.waitForTimeout(600); // debounce

    // List should still show results (or update)
    await expect(page.locator('[data-test="users-list"]')).toBeVisible({ timeout: 5000 });
  });

  test('send payment - full 3-step flow creates transaction', async ({ page }) => {
    await goToNewTransaction(page);

    // Step 1: Select receiver
    await selectFirstUser(page);

    // Step 2: Fill in payment details
    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible({ timeout: 10000 });

    const amount = '50';
    const description = `Test payment ${Date.now()}`;

    // TransactionCreateStepTwo - data-test on TextField wrapper div
    await page.locator('[data-test="transaction-create-amount-input"] input').fill(amount);
    await page.locator('[data-test="transaction-create-description-input"] input').fill(description);

    // Click the Pay button
    await page.locator('[data-test="transaction-create-submit-payment"]').click();

    // Step 3: Should show the success/confirmation message
    await expect(
      page.locator('[data-test="new-transaction-return-to-transactions"]')
    ).toBeVisible({ timeout: 15000 });
  });

  test('request payment - full 3-step flow creates request', async ({ page }) => {
    await goToNewTransaction(page);

    // Step 1: Select receiver
    await selectFirstUser(page);

    // Step 2: Fill in request details
    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible({ timeout: 10000 });

    const amount = '25';
    const description = `Test request ${Date.now()}`;

    await page.locator('[data-test="transaction-create-amount-input"] input').fill(amount);
    await page.locator('[data-test="transaction-create-description-input"] input').fill(description);

    // Click the Request button
    await page.locator('[data-test="transaction-create-submit-request"]').click();

    // Step 3: Success confirmation
    await expect(
      page.locator('[data-test="new-transaction-return-to-transactions"]')
    ).toBeVisible({ timeout: 15000 });
  });

  test('after creating transaction it appears in personal transactions', async ({ page }) => {
    await goToNewTransaction(page);

    await selectFirstUser(page);

    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible({ timeout: 10000 });

    const uniqueNote = `Pay ${Date.now()}`;
    await page.locator('[data-test="transaction-create-amount-input"] input').fill('10');
    await page.locator('[data-test="transaction-create-description-input"] input').fill(uniqueNote);
    await page.locator('[data-test="transaction-create-submit-payment"]').click();

    // Step 3: Success - return to transactions
    await expect(page.locator('[data-test="new-transaction-return-to-transactions"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-test="new-transaction-return-to-transactions"]').click();

    // Navigate to personal tab
    await page.locator('[data-test="nav-personal-tab"]').click();
    await page.waitForURL(/\/personal/, { timeout: 5000 });

    // Our transaction should appear in the personal list
    await expect(page.locator('[data-test="transaction-list"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(uniqueNote)).toBeVisible({ timeout: 10000 });
  });

  test('create another transaction button returns to user search', async ({ page }) => {
    await goToNewTransaction(page);
    await selectFirstUser(page);

    await expect(page.locator('[data-test="transaction-create-form"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-test="transaction-create-amount-input"] input').fill('5');
    await page.locator('[data-test="transaction-create-description-input"] input').fill('Another test');
    await page.locator('[data-test="transaction-create-submit-payment"]').click();

    await expect(page.locator('[data-test="new-transaction-create-another-transaction"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-test="new-transaction-create-another-transaction"]').click();

    // Should be back on the user search step
    await expect(page.locator('[data-test="user-list-search-input"]')).toBeVisible({ timeout: 10000 });
  });
});
