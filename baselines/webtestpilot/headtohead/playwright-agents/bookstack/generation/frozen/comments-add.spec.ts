// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Comments', () => {
  test('3.1 Add a comment to a page', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the page
    await page.goto('/books/book/page/page');
    await page.waitForLoadState('networkidle');

    // Click the Add Comment button
    await page.getByRole('button', { name: 'Add Comment' }).click();
    await page.waitForTimeout(1000);

    // Type into the TinyMCE editor iframe
    const frame = page.frameLocator('#mce_0_ifr');
    const body = frame.locator('body');
    await body.click();
    await body.type('This is a test comment');

    // Click Save Comment
    await page.getByRole('button', { name: 'Save Comment' }).first().click();
    await page.waitForTimeout(1500);

    // Verify "Comment added" notification
    await expect(page.locator('.notification').first()).toContainText('Comment added');

    // Verify the comment text is visible in the comments list
    await expect(page.locator('.comment-box').filter({ hasText: 'This is a test comment' })).toBeVisible();

    // Verify the comments count updated
    await expect(page.locator('.comments-list')).toContainText('Comment');
  });
});
