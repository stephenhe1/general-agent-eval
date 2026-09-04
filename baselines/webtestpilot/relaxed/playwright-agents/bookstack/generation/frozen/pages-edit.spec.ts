// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Pages', () => {
  test('4.4 Edit page content', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // 1. Navigate to /books/book1/page/page-1/edit
    await page.goto('/books/book1/page/page-1/edit');

    // 2. Wait for the TinyMCE editor to load
    await page.waitForSelector('#name');
    await page.waitForSelector('#html-editor_ifr');

    // 3. Click inside the TinyMCE editor iframe body
    const editorFrame = page.frame({ name: 'html-editor_ifr' });
    await editorFrame.waitForSelector('body');
    await editorFrame.click('body');

    // 4. Use Ctrl+A to select all existing content, then type new content
    await editorFrame.locator('body').press('Control+a');
    await editorFrame.type('body', 'Updated page content text.');

    // 5. Click the Save Page button
    await page.getByRole('button', { name: 'Save Page' }).click();
    await page.waitForLoadState('networkidle');

    // Expected: browser redirects to /books/book1/page/page-1
    await expect(page).toHaveURL('/books/book1/page/page-1');

    // Expected: success notification
    await expect(page.locator('.notification.pos')).toContainText('Page successfully updated');

    // Expected: page body displays updated content
    await expect(page.locator('.page-content')).toContainText('Updated page content text.');

    // Expected: Details panel shows a Revision entry
    await expect(page.locator('.entity-details')).toContainText('Revision');
  });
});
