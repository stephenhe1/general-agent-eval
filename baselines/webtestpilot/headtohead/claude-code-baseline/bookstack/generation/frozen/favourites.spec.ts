import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Favourites', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('favourites page loads', async ({ page }) => {
    await page.goto('/favourites');
    await expect(page).toHaveTitle(/My Favourites/);
  });

  test('toggle favourite on book - appears in favourites list', async ({ page }) => {
    // Go to book2 which may not be favourited
    await page.goto('/books/book2');

    // Check favourite button state
    const favBtn = page.locator('button.icon-list-item:has-text("Favourite"), button.icon-list-item:has-text("Unfavourite")').first();
    await expect(favBtn).toBeVisible();

    const isFavourited = await favBtn.textContent().then(t => t?.includes('Unfavourite'));

    if (isFavourited) {
      // Unfavourite first, then favourite
      await favBtn.click();
      await page.waitForLoadState('networkidle');
      // Now favourite
      const favBtn2 = page.locator('button.icon-list-item:has-text("Favourite")').first();
      await favBtn2.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Favourite it
      await favBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Now check favourites page
    await page.goto('/favourites');
    await expect(page.getByText('Book2').first()).toBeVisible();
  });

  test('unfavourite a book - removed from favourites list', async ({ page }) => {
    // First make sure book1 is favourited (it shows "Unfavourite" in seeded data)
    await page.goto('/books/book1');
    const favBtn = page.locator('button.icon-list-item').filter({ hasText: /Favourite|Unfavourite/ }).first();
    await expect(favBtn).toBeVisible();

    const btnText = await favBtn.textContent();
    if (btnText?.includes('Unfavourite')) {
      // It's already favourited, unfavourite it
      await favBtn.click();
      await page.waitForLoadState('networkidle');

      // Verify not in favourites
      await page.goto('/favourites');
      await expect(page.getByText('Book1')).not.toBeVisible();

      // Re-favourite to restore state
      await page.goto('/books/book1');
      const refavBtn = page.locator('button.icon-list-item:has-text("Favourite")').first();
      await refavBtn.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Favourite then unfavourite
      await favBtn.click();
      await page.waitForLoadState('networkidle');

      await page.goto('/books/book1');
      const unfavBtn = page.locator('button.icon-list-item:has-text("Unfavourite")').first();
      await unfavBtn.click();
      await page.waitForLoadState('networkidle');

      await page.goto('/favourites');
      await expect(page.getByText('Book1')).not.toBeVisible();
    }
  });
});
