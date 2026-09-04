// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  test('View book detail page', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the seeded book1 detail page
    await page.goto('/books/book1');

    // Page title should contain "Book1"
    await expect(page).toHaveTitle(/Book1/);

    // Actions sidebar should show a link to create a New Page
    await expect(page.getByRole('link', { name: 'New Page', exact: true }).first()).toBeVisible();

    // Actions sidebar should show an Edit link
    await expect(page.getByRole('link', { name: 'Edit', exact: true }).first()).toBeVisible();
  });
});
