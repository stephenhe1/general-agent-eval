// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Pages', () => {
  test('4.2 Create a page inside a chapter', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // 1. Navigate to /books/book1/chapter/chapter-2/create-page (redirects to draft URL)
    await page.goto('/books/book1/chapter/chapter-2/create-page');

    // 2. Wait for the TinyMCE editor to load
    await page.waitForSelector('#name');
    await page.waitForSelector('#html-editor_ifr');

    // 3. Fill #name with the page title
    await page.fill('#name', 'Test Chapter Page Beta');

    // 4. Click inside the TinyMCE editor iframe body and type content
    const editorFrame = page.frame({ name: 'html-editor_ifr' });
    await editorFrame.waitForSelector('body');
    await editorFrame.click('body');
    await editorFrame.type('body', 'Chapter page body text.');

    // 5. Click the Save Page button
    await page.getByRole('button', { name: 'Save Page' }).click();
    await page.waitForLoadState('networkidle');

    // Expected: browser redirects to /books/book1/page/<slug>
    await expect(page).toHaveURL(/\/books\/book1\/page\//);

    // Expected: success notification
    await expect(page.locator('.notification.pos')).toContainText('Page successfully created');

    // Expected: breadcrumb contains Books > Book1 > Chapter 2 > Test Chapter Page Beta
    const breadcrumbs = page.locator('.breadcrumbs a');
    await expect(breadcrumbs.filter({ hasText: 'Books' })).toBeVisible();
    await expect(breadcrumbs.filter({ hasText: 'Book1' })).toBeVisible();
    await expect(breadcrumbs.filter({ hasText: 'Chapter 2' })).toBeVisible();
    await expect(breadcrumbs.filter({ hasText: 'Test Chapter Page Beta' })).toBeVisible();
    // Confirm 4 breadcrumbs: Books, Book1, Chapter 2, Test Chapter Page Beta
    await expect(breadcrumbs).toHaveCount(4);
  });
});
