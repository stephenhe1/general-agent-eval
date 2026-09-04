// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Pages', () => {
  test('4.3 View a page', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // 1. Navigate to /books/book1/page/page-1
    await page.goto('/books/book1/page/page-1');
    await page.waitForLoadState('networkidle');

    // Expected: page title is "Page 1 | BookStack"
    await expect(page).toHaveTitle('Page 1 | BookStack');

    // Expected: page body contains seeded page content
    await expect(page.locator('.page-content')).toBeVisible();

    // Expected: Book Navigation sidebar is present
    await expect(page.locator('.book-tree')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Book Navigation' })).toBeVisible();

    // Expected: Actions panel contains Edit, Copy, Move, Revisions, Delete links
    await expect(page.getByRole('heading', { name: 'Actions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Copy', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Move', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Revisions', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delete', exact: true })).toBeVisible();
  });
});
