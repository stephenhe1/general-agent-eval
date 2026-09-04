// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('Search for text that exists', async ({ page }) => {
    // Seed: log in as admin
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to home and use header search box
    await page.goto('/');
    await page.locator('#header-search-box-input').click();
    await page.locator('#header-search-box-input').fill('Description');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');

    // Verify URL contains /search
    expect(page.url()).toContain('/search');

    // Verify "total results found" text shows N > 0
    const bodyText = await page.locator('body').innerText();
    const countMatch = bodyText.match(/(\d+) total results found/);
    expect(countMatch).not.toBeNull();
    const count = parseInt(countMatch![1], 10);
    expect(count).toBeGreaterThan(0);

    // Verify at least one entity-list-item is visible
    await expect(page.locator('.entity-list-item').first()).toBeVisible();
  });
});
