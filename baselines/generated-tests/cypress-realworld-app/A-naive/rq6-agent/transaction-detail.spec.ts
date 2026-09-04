import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

test.describe('Transaction Detail', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  /** Navigate to the public feed and open the first transaction; returns its ID */
  async function openFirstPublicTransaction(page: any): Promise<string> {
    await page.locator('[data-test="nav-public-tab"]').click();
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
    const testAttr = await firstItem.getAttribute('data-test') ?? '';
    const transactionId = testAttr.replace('transaction-item-', '');
    await firstItem.click();
    await page.waitForURL(/\/transaction\/[^/]+$/, { timeout: 10000 });
    return transactionId;
  }

  /** Get the transaction ID from the current page URL */
  function getTransactionIdFromUrl(page: any): string {
    return page.url().split('/transaction/')[1] ?? '';
  }

  test('transaction detail page shows sender, receiver, and description', async ({ page }) => {
    await openFirstPublicTransaction(page);

    await expect(page.locator('[data-test="transaction-detail-header"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-test="transaction-sender-avatar"]')).toBeVisible();
    await expect(page.locator('[data-test="transaction-receiver-avatar"]')).toBeVisible();
    await expect(page.locator('[data-test="transaction-description"]')).toBeVisible();
  });

  test('liking a transaction increments the like count', async ({ page }) => {
    // Find a transaction whose like button is enabled (not already liked by current user)
    await page.locator('[data-test="nav-public-tab"]').click();
    await expect(page.locator('[data-test^="transaction-item-"]').first()).toBeVisible({ timeout: 10000 });

    // Try several transactions to find one with an enabled like button
    const items = page.locator('[data-test^="transaction-item-"]');
    let transactionId = '';
    let found = false;

    for (let i = 0; i < 5 && !found; i++) {
      const item = items.nth(i);
      const testAttr = await item.getAttribute('data-test') ?? '';
      const id = testAttr.replace('transaction-item-', '');
      await item.click();
      await page.waitForURL(/\/transaction\/[^/]+$/, { timeout: 10000 });

      const likeBtn = page.locator(`[data-test="transaction-like-button-${id}"]`);
      await expect(likeBtn).toBeVisible({ timeout: 5000 });
      const isDisabled = await likeBtn.isDisabled();

      if (!isDisabled) {
        transactionId = id;
        found = true;
      } else {
        // Go back and try next
        await page.goBack();
        await page.waitForURL(/\/$/, { timeout: 5000 });
      }
    }

    if (!found || !transactionId) {
      test.skip(true, 'No unliked transactions available for current user');
      return;
    }

    // Read the current like count
    const likeCountLocator = page.locator(`[data-test="transaction-like-count-${transactionId}"]`);
    await expect(likeCountLocator).toBeVisible({ timeout: 5000 });
    const likeCountText = await likeCountLocator.textContent();
    const initialLikeCount = parseInt(likeCountText?.trim() ?? '0', 10);

    // Click the like button
    await page.locator(`[data-test="transaction-like-button-${transactionId}"]`).click();

    // Wait for the count to update
    await page.waitForTimeout(1000);

    // The like count should have incremented
    const newLikeCountText = await likeCountLocator.textContent();
    const newLikeCount = parseInt(newLikeCountText?.trim() ?? '0', 10);
    expect(newLikeCount).toBeGreaterThan(initialLikeCount);
  });

  test('adding a comment to a transaction makes it appear', async ({ page }) => {
    await openFirstPublicTransaction(page);
    const transactionId = getTransactionIdFromUrl(page);

    // The comment input is always present in the detail view
    const commentInput = page.locator(`[data-test="transaction-comment-input-${transactionId}"]`);
    await expect(commentInput).toBeVisible({ timeout: 10000 });

    // Count comments before (list is only rendered if there are comments)
    const commentListVisible = await page.locator('[data-test="comments-list"]').isVisible();
    const commentsBefore = commentListVisible
      ? await page.locator('[data-test="comments-list"] li').count()
      : 0;

    // Type and submit a comment
    const commentText = `Auto test ${Date.now()}`;
    await commentInput.fill(commentText);
    await commentInput.press('Enter');

    // The comment should appear - comments-list should now be visible
    await expect(page.locator('[data-test="comments-list"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-test="comments-list"]').getByText(commentText)).toBeVisible({ timeout: 10000 });

    // Comment count should have increased
    const commentsAfter = await page.locator('[data-test="comments-list"] li').count();
    expect(commentsAfter).toBeGreaterThan(commentsBefore);
  });

  test('transaction detail URL matches clicked transaction', async ({ page }) => {
    await page.locator('[data-test="nav-public-tab"]').click();
    const firstItem = page.locator('[data-test^="transaction-item-"]').first();
    await expect(firstItem).toBeVisible({ timeout: 10000 });
    const testAttr = await firstItem.getAttribute('data-test') ?? '';
    const expectedId = testAttr.replace('transaction-item-', '');

    await firstItem.click();
    await page.waitForURL(/\/transaction\/[^/]+$/, { timeout: 10000 });

    // URL should contain the transaction ID we clicked
    expect(page.url()).toContain(`/transaction/${expectedId}`);
  });
});
