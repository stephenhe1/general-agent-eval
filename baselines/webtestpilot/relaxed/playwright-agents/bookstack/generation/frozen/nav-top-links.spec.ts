// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('Use main top navigation links', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Click "Books" in the top navigation header
    await page.locator('header a').filter({ hasText: /^Books$/ }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /books and title contains "Books"
    expect(page.url()).toMatch(/\/books$/);
    await expect(page).toHaveTitle(/Books/);

    // Go back to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click "Shelves" in the top navigation header
    await page.locator('header a').filter({ hasText: /^Shelves$/ }).first().click();
    await page.waitForLoadState('networkidle');

    // Verify URL is /shelves and title contains "Shelves"
    expect(page.url()).toMatch(/\/shelves$/);
    await expect(page).toHaveTitle(/Shelves/);
  });
});
