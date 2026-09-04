// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('Search via direct URL with matching term', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate directly to search URL
    await page.goto('/search?term=Book1');
    await page.waitForLoadState('networkidle');

    // Verify page title contains "Search for Book1"
    await expect(page).toHaveTitle(/Search for Book1/);

    // Verify result count text shows 1 result found
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/1 result found/);

    // Verify Book1 entity is visible in results
    await expect(page.locator('.entity-list-item').first()).toBeVisible();
    const firstItemText = await page.locator('.entity-list-item').first().innerText();
    expect(firstItemText).toContain('Book1');
  });
});
