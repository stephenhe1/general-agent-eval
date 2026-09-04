// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Favorites', () => {
  test('7.3 Unfavourite Book2 and verify it is removed', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to Book2 and ensure it is favourited first
    await page.goto('/books/book2');
    await page.waitForLoadState('networkidle');

    const favBtn = page.getByRole('button', { name: 'Favourite', exact: true });
    if (await favBtn.isVisible().catch(() => false)) {
      await favBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click the Unfavourite button in the Actions sidebar
    await page.getByRole('button', { name: 'Unfavourite', exact: true }).click();
    await page.waitForTimeout(1500);

    // Verify the notification appears
    await expect(page.locator('.notification').first()).toContainText('"Book2" has been removed from your favourites');

    // Verify the button label reverts to Favourite
    await expect(page.getByRole('button', { name: 'Favourite', exact: true })).toBeVisible();

    // Navigate to /favourites and confirm Book2 is no longer listed
    await page.goto('/favourites');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Book2')).toHaveCount(0);
  });
});
