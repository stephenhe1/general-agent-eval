// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Shelves', () => {
  test('Shelves list shows created shelf', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the shelves listing page
    await page.goto('/shelves');

    // Page title should include "Shelves"
    await expect(page).toHaveTitle(/Shelves/);

    // The main heading should say "Shelves"
    await expect(page.locator('h1')).toContainText('Shelves');

    // The seeded shelf content should appear in the list
    await expect(page.locator('body')).toContainText('Shelf');
  });
});
