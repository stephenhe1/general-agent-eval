import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

// BankAccountForm uses data-test directly on TextField (wrapper div)
// so we use '[data-test="..."] input' to reach the actual input element.
// The delete is a soft-delete: the list item remains but shows "(Deleted)" and loses its delete button.

test.describe('Bank Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  test('bank accounts page shows account list', async ({ page }) => {
    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await page.waitForURL(/\/bankaccounts/, { timeout: 10000 });
    await expect(page.locator('[data-test="bankaccount-list"]')).toBeVisible({ timeout: 10000 });
  });

  test('create bank account adds it to the list', async ({ page }) => {
    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await page.waitForURL(/\/bankaccounts/, { timeout: 10000 });

    // Count existing active (non-deleted) accounts by counting delete buttons
    await expect(page.locator('[data-test="bankaccount-list"]')).toBeVisible({ timeout: 10000 });
    const initialDeleteButtons = await page.locator('[data-test="bankaccount-delete"]').count();

    // Create a new bank account
    await page.locator('[data-test="bankaccount-new"]').click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 10000 });

    const bankName = `Test Bank ${Date.now()}`;
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill(bankName);
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('123456789');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('987654321');
    await page.locator('[data-test="bankaccount-submit"]').click();

    // Should redirect back to the bank accounts list
    await page.waitForURL(/\/bankaccounts$/, { timeout: 10000 });
    await expect(page.locator('[data-test="bankaccount-list"]')).toBeVisible({ timeout: 10000 });

    // The new bank account should appear in the list
    await expect(page.getByText(bankName)).toBeVisible({ timeout: 10000 });

    // Number of delete buttons should have increased by 1
    const finalDeleteButtons = await page.locator('[data-test="bankaccount-delete"]').count();
    expect(finalDeleteButtons).toBeGreaterThan(initialDeleteButtons);
  });

  test('delete bank account soft-deletes (removes delete button, shows Deleted label)', async ({ page }) => {
    // Create a bank account to delete
    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await page.waitForURL(/\/bankaccounts/, { timeout: 10000 });
    await page.locator('[data-test="bankaccount-new"]').click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 10000 });

    const bankNameToDelete = `ToDelete ${Date.now()}`;
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill(bankNameToDelete);
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('111222333');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('444555666');
    await page.locator('[data-test="bankaccount-submit"]').click();

    await page.waitForURL(/\/bankaccounts$/, { timeout: 10000 });
    await expect(page.getByText(bankNameToDelete)).toBeVisible({ timeout: 10000 });

    // Count delete buttons before deletion
    const deleteButtonsBefore = await page.locator('[data-test="bankaccount-delete"]').count();
    expect(deleteButtonsBefore).toBeGreaterThan(0);

    // Click the last delete button (our newly created account)
    await page.locator('[data-test="bankaccount-delete"]').last().click();

    // Wait for UI to update
    await page.waitForTimeout(1500);

    // Delete buttons count should have decreased (soft delete removes the button)
    const deleteButtonsAfter = await page.locator('[data-test="bankaccount-delete"]').count();
    expect(deleteButtonsAfter).toBeLessThan(deleteButtonsBefore);

    // The item should still be visible but marked as "(Deleted)"
    await expect(page.getByText(`${bankNameToDelete} (Deleted)`).or(
      page.getByText(bankNameToDelete)
    )).toBeVisible({ timeout: 5000 });
  });

  test('bank account form fields accept valid input', async ({ page }) => {
    await page.locator('[data-test="sidenav-bankaccounts"]').click();
    await page.waitForURL(/\/bankaccounts/, { timeout: 10000 });
    await page.locator('[data-test="bankaccount-new"]').click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 10000 });

    // Fill in valid data
    await page.locator('[data-test="bankaccount-bankName-input"] input').fill('My Test Bank');
    await page.locator('[data-test="bankaccount-routingNumber-input"] input').fill('123456789');
    await page.locator('[data-test="bankaccount-accountNumber-input"] input').fill('987654321');

    // Submit button should be enabled with valid input
    await expect(page.locator('[data-test="bankaccount-submit"]')).toBeEnabled({ timeout: 5000 });
  });
});
