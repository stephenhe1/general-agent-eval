// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Chapters', () => {
  test('3.3 View chapter detail page', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the seeded chapter-2
    await page.goto('/books/book1/chapter/chapter-2');

    // Page title should be Chapter 2 | BookStack
    await expect(page).toHaveTitle('Chapter 2 | BookStack');

    // Book Navigation sidebar should be visible
    await expect(page.getByText('Book Navigation')).toBeVisible();

    // Actions sidebar contains expected chapter actions
    await expect(page.getByRole('link', { name: 'New Page', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delete', exact: true })).toBeVisible();
  });
});
