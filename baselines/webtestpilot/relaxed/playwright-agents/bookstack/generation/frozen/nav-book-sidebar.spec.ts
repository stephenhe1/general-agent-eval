// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Use Book Navigation sidebar on a page', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to page-1
    await page.goto('/books/book1/page/page-1');
    await page.waitForLoadState('networkidle');

    // In the Book Navigation sidebar, click "Chapter 2" link
    await page.locator('.book-tree a').filter({ hasText: 'Chapter 2' }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify URL contains /books/book1/chapter/chapter-2
    expect(page.url()).toContain('/books/book1/chapter/chapter-2');

    // Verify title contains "Chapter 2"
    await expect(page).toHaveTitle(/Chapter 2/);
  });
});
