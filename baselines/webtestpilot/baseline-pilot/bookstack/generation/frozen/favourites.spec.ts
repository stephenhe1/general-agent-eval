import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Favourites', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('favourites page loads and shows title', async ({ page }) => {
    await page.goto('/favourites');
    await expect(page).toHaveTitle(/Favourites/);
    await expect(page.getByRole('heading', { name: /Favourites/i })).toBeVisible();
  });

  test('toggling favourite on a book adds it to favourites list', async ({ page }) => {
    // First ensure it's NOT in favourites by visiting favourites
    await page.goto('/books/book1');

    // Find and click the Favourite button
    const favBtn = page.getByRole('button', { name: 'Favourite' });
    await expect(favBtn).toBeVisible();
    const isCurrentlyFavourited = await favBtn.evaluate((el: Element) =>
      el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true'
    );

    // If already favourited, unfavourite first
    if (isCurrentlyFavourited) {
      await favBtn.click();
      await page.waitForTimeout(500);
    }

    // Now favourite it
    await favBtn.click();
    await page.waitForTimeout(500);

    // Navigate to favourites to confirm it was added
    await page.goto('/favourites');
    await expect(page.getByText('Book1')).toBeVisible();

    // Clean up: remove from favourites
    await page.goto('/books/book1');
    await page.getByRole('button', { name: /Favourite|Unfavourite/i }).click();
    await page.waitForTimeout(300);
  });
});
