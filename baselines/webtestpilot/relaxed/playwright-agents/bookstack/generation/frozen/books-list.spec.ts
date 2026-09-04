// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Books', () => {
  test('View books list', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to the books listing page
    await page.goto('/books');

    // Page title should contain "Books"
    await expect(page).toHaveTitle(/Books/);

    // Seeded Book1 should be visible in the books grid
    await expect(page.getByRole('link', { name: /Book1/ }).first()).toBeVisible();

    // Seeded Book2 should be visible in the books grid
    await expect(page.getByRole('link', { name: /Book2/ }).first()).toBeVisible();
  });
});
