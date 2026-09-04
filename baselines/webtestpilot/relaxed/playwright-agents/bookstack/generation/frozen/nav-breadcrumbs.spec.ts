// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Click breadcrumb links to navigate hierarchy', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to a page
    await page.goto('/books/book1/page/page-1');
    await page.waitForLoadState('networkidle');

    // Click the "Book1" breadcrumb link
    await page.locator('.breadcrumbs a').filter({ hasText: 'Book1' }).click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /books/book1
    expect(page.url()).toContain('/books/book1');

    // Navigate back to page-1
    await page.goto('/books/book1/page/page-1');
    await page.waitForLoadState('networkidle');

    // Click the "Books" breadcrumb link
    await page.locator('.breadcrumbs a').filter({ hasText: 'Books' }).click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /books
    expect(page.url()).toMatch(/\/books$/);
  });
});
