// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Favorites', () => {
  test('7.2 Verify Book2 appears in the Favourites list', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Ensure Book2 is favourited
    await page.goto('/books/book2');
    await page.waitForLoadState('networkidle');

    const favBtn = page.getByRole('button', { name: 'Favourite', exact: true });
    if (await favBtn.isVisible().catch(() => false)) {
      await favBtn.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to the My Favourites page
    await page.goto('/favourites');
    await page.waitForLoadState('networkidle');

    // Verify the page title
    await expect(page).toHaveTitle('My Favourites | BookStack');

    // Verify Book2 is listed on the favourites page
    await expect(page.getByText('Book2')).toBeVisible();
  });
});
