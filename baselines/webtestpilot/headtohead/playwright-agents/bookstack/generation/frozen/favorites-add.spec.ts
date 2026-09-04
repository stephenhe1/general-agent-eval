// spec: specs/advanced-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Favorites', () => {
  test('7.1 Favourite a book', async ({ page }) => {
    // Seed: log in as admin first
    await page.goto('/login');
    await page.fill('#email', 'admin@admin.com');
    await page.fill('#password', 'password');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');

    // Navigate to Book2
    await page.goto('/books/book2');
    await page.waitForLoadState('networkidle');

    // Ensure the book is not already favourited (remove if so)
    const unfavBtn = page.getByRole('button', { name: 'Unfavourite', exact: true });
    if (await unfavBtn.isVisible().catch(() => false)) {
      await unfavBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click the Favourite button in the Actions sidebar
    await page.getByRole('button', { name: 'Favourite', exact: true }).click();
    await page.waitForTimeout(1500);

    // Verify the notification appears
    await expect(page.locator('.notification').first()).toContainText('"Book2" has been added to your favourites');

    // Verify the button changed to Unfavourite
    await expect(page.getByRole('button', { name: 'Unfavourite', exact: true })).toBeVisible();
  });
});
