// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Comments', () => {
  test('3.2 Delete own comment', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the page and ensure there is a comment to delete
    await page.goto('/books/book/page/page');
    await page.waitForLoadState('networkidle');

    // Add a comment if 'This is a test comment' is not already present
    const commentBox = page.locator('.comment-box').filter({ hasText: 'This is a test comment' });
    const commentExists = await commentBox.isVisible().catch(() => false);
    if (!commentExists) {
      await page.getByRole('button', { name: 'Add Comment' }).click();
      await page.waitForTimeout(1000);
      const frame = page.frameLocator('#mce_0_ifr');
      const body = frame.locator('body');
      await body.click();
      await body.type('This is a test comment');
      await page.getByRole('button', { name: 'Save Comment' }).first().click();
      await page.waitForTimeout(1500);
    }

    // Locate the comment box containing the test comment
    const targetComment = page.locator('.comment-box').filter({ hasText: 'This is a test comment' });
    await expect(targetComment).toBeVisible();

    // Click the Delete dropdown toggle on that comment (aria-haspopup button)
    await targetComment.locator('button[aria-haspopup="true"]').filter({ hasText: 'Delete' }).click();
    await page.waitForTimeout(500);

    // Click the confirm Delete button inside the dropdown (refs=page-comment@delete-button)
    await targetComment.locator('[refs="page-comment@delete-button"]').click();
    await page.waitForTimeout(1500);

    // Verify "Comment deleted" notification
    await expect(page.locator('.notification').first()).toContainText('Comment deleted');

    // Verify the comment is no longer visible
    await expect(page.locator('.comment-box').filter({ hasText: 'This is a test comment' })).toHaveCount(0);
  });
});
