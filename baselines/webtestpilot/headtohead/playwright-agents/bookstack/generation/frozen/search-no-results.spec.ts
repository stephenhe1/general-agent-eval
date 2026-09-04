// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('Search for non-existent text', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate directly to search URL with non-existent term
    await page.goto('/search?term=xyzxyz123nonexistent');
    await page.waitForLoadState('networkidle');

    // Verify "0 total results found" or "No items available" text
    const bodyText = await page.locator('body').innerText();
    const hasZeroResults = /0 total results found/.test(bodyText);
    const hasNoItems = /No items available/.test(bodyText);
    expect(hasZeroResults || hasNoItems).toBe(true);
  });
});
