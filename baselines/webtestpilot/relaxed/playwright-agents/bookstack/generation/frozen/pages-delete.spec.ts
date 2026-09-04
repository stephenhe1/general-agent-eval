// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Pages', () => {
  test('4.5 Delete a page', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Create a page to delete so the test is independent
    await page.goto('/books/book1/create-page');
    await page.waitForSelector('#name');
    await page.waitForSelector('#html-editor_ifr');
    await page.fill('#name', 'Test Page Delete Gamma');
    const editorFrame = page.frame({ name: 'html-editor_ifr' });
    await editorFrame.waitForSelector('body');
    await editorFrame.click('body');
    await editorFrame.type('body', 'Content to delete.');
    await page.getByRole('button', { name: 'Save Page' }).click();
    await page.waitForLoadState('networkidle');
    // Capture the slug from the redirected URL
    const createdUrl = page.url();
    const slug = createdUrl.split('/page/')[1];

    // 1. Navigate to /books/book1/page/<slug>/delete
    await page.goto(`/books/book1/page/${slug}/delete`);
    await page.waitForLoadState('networkidle');

    // 2. Confirm the deletion page shows the expected text
    await expect(page.getByText('Are you sure you want to delete this page?')).toBeVisible();

    // 3. Click the Confirm button
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForLoadState('networkidle');

    // Expected: browser redirects to the parent book page /books/book1
    await expect(page).toHaveURL('/books/book1');

    // Expected: success notification
    await expect(page.locator('.notification.pos')).toContainText('Page successfully deleted');

    // Expected: deleted page no longer appears in the book's content list
    await expect(page.getByText('Test Page Delete Gamma')).not.toBeVisible();
  });
});
