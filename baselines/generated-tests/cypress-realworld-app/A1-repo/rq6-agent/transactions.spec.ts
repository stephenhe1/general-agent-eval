import { test, expect } from "@playwright/test";
import { loginAsDefaultUser, BASE } from "./helpers";

test.describe("Create Transaction", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
  });

  test("new payment flow - sends money to a contact", async ({ page }) => {
    // Navigate to new transaction
    await page.goto(`${BASE}/transaction/new`);
    await expect(
      page.locator('[data-test="user-list-search-input"]')
    ).toBeVisible({ timeout: 10000 });

    // Search for a contact
    await page
      .locator('[data-test="user-list-search-input"]')
      .fill("Kristian");
    await page.waitForTimeout(600);

    // Select first user from list
    const userItem = page.locator('[data-test="users-list"] li').first();
    await expect(userItem).toBeVisible({ timeout: 5000 });
    await userItem.click();

    // Step 2: Fill amount and description
    // The amount TextField uses InputProps.inputProps.id="amount" which overrides
    // the outer id, so the actual <input> has id="amount". Use placeholder selector.
    const amount = "25";
    const description = `Test payment ${Date.now()}`;
    await expect(page.getByPlaceholder("Amount")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("Amount").fill(amount);
    await page.getByPlaceholder("Add a note").fill(description);

    // Submit payment
    await page
      .locator('[data-test="transaction-create-submit-payment"]')
      .click();

    // Step 3: Confirmation page
    await expect(
      page.locator('[data-test="new-transaction-return-to-transactions"]')
    ).toBeVisible({ timeout: 10000 });

    // Return to transactions
    await page
      .locator('[data-test="new-transaction-return-to-transactions"]')
      .click();
    await page.waitForURL(/\/(public|contacts|personal|$)/, { timeout: 5000 });

    // Verify the new payment appears in the "Mine" (personal) tab
    await page.locator('[data-test="nav-personal-tab"]').click();
    await page.waitForTimeout(1500);

    // The description should appear in one of the transaction items
    const items = page.locator('[data-test^="transaction-item-"]');
    await expect(items.first()).toBeVisible({ timeout: 10000 });

    // Look for the description in the list
    const descriptionEl = page
      .locator('[data-test^="transaction-item-"]')
      .filter({ hasText: description });
    await expect(descriptionEl).toBeVisible({ timeout: 5000 });
  });

  test("new request flow - requests money from a contact", async ({ page }) => {
    await page.goto(`${BASE}/transaction/new`);
    await expect(
      page.locator('[data-test="user-list-search-input"]')
    ).toBeVisible({ timeout: 10000 });

    // Search for a contact
    await page
      .locator('[data-test="user-list-search-input"]')
      .fill("Darrel");
    await page.waitForTimeout(600);

    const userItem = page.locator('[data-test="users-list"] li').first();
    await expect(userItem).toBeVisible({ timeout: 5000 });
    await userItem.click();

    // Step 2: Fill amount and description
    const description = `Test request ${Date.now()}`;
    await expect(page.getByPlaceholder("Amount")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("Amount").fill("50");
    await page.getByPlaceholder("Add a note").fill(description);

    // Submit request (not payment)
    await page
      .locator('[data-test="transaction-create-submit-request"]')
      .click();

    // Confirmation step
    await expect(
      page.locator('[data-test="new-transaction-return-to-transactions"]')
    ).toBeVisible({ timeout: 10000 });

    // Return and verify in personal tab
    await page
      .locator('[data-test="new-transaction-return-to-transactions"]')
      .click();
    await page.waitForURL(/\/(public|contacts|personal|$)/, { timeout: 5000 });
    await page.locator('[data-test="nav-personal-tab"]').click();
    await page.waitForTimeout(1500);

    // Verify the request transaction appears
    const descriptionEl = page
      .locator('[data-test^="transaction-item-"]')
      .filter({ hasText: description });
    await expect(descriptionEl).toBeVisible({ timeout: 5000 });
  });

  test("new transaction step three has create-another button", async ({
    page,
  }) => {
    await page.goto(`${BASE}/transaction/new`);
    await expect(
      page.locator('[data-test="user-list-search-input"]')
    ).toBeVisible({ timeout: 10000 });

    // Pick any user and complete transaction
    const userItem = page.locator('[data-test="users-list"] li').first();
    await expect(userItem).toBeVisible({ timeout: 5000 });
    await userItem.click();

    await expect(page.getByPlaceholder("Amount")).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder("Amount").fill("10");
    await page.getByPlaceholder("Add a note").fill("quick test payment");
    await page
      .locator('[data-test="transaction-create-submit-payment"]')
      .click();

    // Both buttons should be visible on confirmation
    await expect(
      page.locator('[data-test="new-transaction-return-to-transactions"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(
        '[data-test="new-transaction-create-another-transaction"]'
      )
    ).toBeVisible();

    // Create another should return to step 1
    await page
      .locator('[data-test="new-transaction-create-another-transaction"]')
      .click();
    await expect(
      page.locator('[data-test="user-list-search-input"]')
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Transaction Detail", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
  });

  test("transaction detail page shows description", async ({ page }) => {
    // Navigate to the personal tab to see own transactions
    await page.goto(`${BASE}/personal`);
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
    await firstItem.click();

    await page.waitForURL(/\/transaction\//, { timeout: 5000 });
    await expect(
      page.locator('[data-test="transaction-detail-header"]')
    ).toBeVisible();
    // Description text should appear
    await expect(
      page.locator('[data-test="transaction-description"]')
    ).toBeVisible();
  });

  test("like a transaction increments like count", async ({ page }) => {
    // Navigate to public transactions to find one to like
    await page.goto(`${BASE}/`);
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });

    // Get transaction ID
    const dataTest = await firstItem.getAttribute("data-test");
    const txId = dataTest?.replace("transaction-item-", "");

    await firstItem.click();
    await page.waitForURL(/\/transaction\//, { timeout: 5000 });

    // Get current like count
    const likeCountEl = page.locator(
      `[data-test="transaction-like-count-${txId}"]`
    );
    await expect(likeCountEl).toBeVisible({ timeout: 5000 });
    const countBefore = parseInt(
      (await likeCountEl.textContent()) || "0"
    );

    // Click like button
    await page
      .locator(`[data-test="transaction-like-button-${txId}"]`)
      .click();
    await page.waitForTimeout(500);

    // Count should increment by 1
    const countAfter = parseInt(
      (await likeCountEl.textContent()) || "0"
    );
    expect(countAfter).toBe(countBefore + 1);
  });

  test("add a comment appears in comments list", async ({ page }) => {
    // Navigate to a transaction detail
    await page.goto(`${BASE}/`);
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });

    const dataTest = await firstItem.getAttribute("data-test");
    const txId = dataTest?.replace("transaction-item-", "");

    await firstItem.click();
    await page.waitForURL(/\/transaction\//, { timeout: 5000 });

    // Type a comment
    const commentText = `Test comment ${Date.now()}`;
    const commentInput = page.locator(
      `[data-test="transaction-comment-input-${txId}"]`
    );
    await expect(commentInput).toBeVisible({ timeout: 5000 });
    await commentInput.fill(commentText);
    await commentInput.press("Enter");

    // Comment should appear in the list
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 5000 });
  });
});
