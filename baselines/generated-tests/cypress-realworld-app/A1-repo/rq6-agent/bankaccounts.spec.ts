import { test, expect } from "@playwright/test";
import { loginAsDefaultUser, BASE } from "./helpers";

test.describe("Bank Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.goto(`${BASE}/bankaccounts`);
    await page.waitForURL(/\/bankaccounts/, { timeout: 5000 });
  });

  test("bank accounts list shows existing accounts", async ({ page }) => {
    const list = page.locator('[data-test="bankaccount-list"]');
    await expect(list).toBeVisible({ timeout: 10000 });

    // Heath93 has one bank account
    const items = page.locator('[data-test^="bankaccount-list-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
    expect(await items.count()).toBeGreaterThan(0);

    // Should show the bank name
    await expect(
      page.getByText(/Waters, King and O'Reilly Bank/)
    ).toBeVisible();
  });

  test("create new bank account appears in list", async ({ page }) => {
    // Find create link/button (usually "+" or "Create" button)
    const createBtn = page
      .getByRole("button", { name: /create/i })
      .or(page.getByRole("link", { name: /create/i }));
    await createBtn.first().click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 5000 });

    const bankName = `Test Bank ${Date.now()}`;
    // Use id selectors since data-test is on MUI TextField wrappers
    await page.locator("#bankaccount-bankName-input").fill(bankName);
    await page.locator("#bankaccount-routingNumber-input").fill("123456789");
    await page.locator("#bankaccount-accountNumber-input").fill("9876543210");
    await page.locator('[data-test="bankaccount-submit"]').click();

    // Should return to bank accounts list
    await page.waitForURL(/\/bankaccounts$/, { timeout: 10000 });

    // The new bank account should appear in the list
    await expect(
      page.locator('[data-test="bankaccount-list"]')
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(bankName)).toBeVisible({ timeout: 5000 });
  });

  test("delete bank account marks it as deleted", async ({ page }) => {
    // First create a bank account to delete
    const createBtn = page
      .getByRole("button", { name: /create/i })
      .or(page.getByRole("link", { name: /create/i }));
    await createBtn.first().click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 5000 });

    const bankName = `Delete Me Bank ${Date.now()}`;
    await page.locator("#bankaccount-bankName-input").fill(bankName);
    await page.locator("#bankaccount-routingNumber-input").fill("987654321");
    await page.locator("#bankaccount-accountNumber-input").fill("1234567890");
    await page.locator('[data-test="bankaccount-submit"]').click();

    await page.waitForURL(/\/bankaccounts$/, { timeout: 10000 });
    const itemWithBank = page
      .locator('[data-test^="bankaccount-list-item-"]')
      .filter({ hasText: bankName });
    await expect(itemWithBank).toBeVisible({ timeout: 5000 });

    // Confirm the delete button is present before deletion
    const deleteBtn = itemWithBank.locator('[data-test="bankaccount-delete"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    // Delete the account
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    // After deletion the app shows "(Deleted)" in the item and hides the delete button
    await expect(
      page.locator('[data-test^="bankaccount-list-item-"]').filter({ hasText: bankName })
    ).toContainText("(Deleted)", { timeout: 5000 });

    // Delete button should no longer exist for the deleted item
    const itemAfter = page
      .locator('[data-test^="bankaccount-list-item-"]')
      .filter({ hasText: bankName });
    await expect(
      itemAfter.locator('[data-test="bankaccount-delete"]')
    ).toHaveCount(0);
  });

  test("bank account form validates routing number length", async ({
    page,
  }) => {
    const createBtn = page
      .getByRole("button", { name: /create/i })
      .or(page.getByRole("link", { name: /create/i }));
    await createBtn.first().click();
    await page.waitForURL(/\/bankaccounts\/new/, { timeout: 5000 });

    await page.locator("#bankaccount-bankName-input").fill("Valid Bank Name");
    // Routing number must be exactly 9 digits - enter too short
    await page.locator("#bankaccount-routingNumber-input").fill("1234");
    await page.locator("#bankaccount-accountNumber-input").fill("1234567890");
    // Click elsewhere to trigger validation
    await page.locator("#bankaccount-bankName-input").click();

    const submitBtn = page.locator('[data-test="bankaccount-submit"]');
    await expect(submitBtn).toBeDisabled();
  });
});
