import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Home Page & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('home page loads and shows recently viewed section', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BookStack/);
    // Recently Viewed section should exist
    await expect(page.getByText('My Recently Viewed')).toBeVisible();
  });

  test('home page shows entity list items', async ({ page }) => {
    await page.goto('/');
    // There should be entity-list items (books, pages etc.)
    const entityItems = page.locator('.entity-list-item');
    await expect(entityItems.first()).toBeVisible();
  });

  test('navigation header has main links', async ({ page }) => {
    await page.goto('/');
    // Use data-shortcut attributes from BookStack's nav (avoids duplicate link issues)
    await expect(page.locator('[data-shortcut="shelves_view"]')).toBeVisible();
    await expect(page.locator('[data-shortcut="books_view"]')).toBeVisible();
    // Settings link visible (admin)
    await expect(page.locator('[data-shortcut="settings_view"]')).toBeVisible();
  });

  test('navigation: clicking Shelves link goes to shelves page', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-shortcut="shelves_view"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/shelves/);
    await expect(page).toHaveTitle(/Shelves/);
  });

  test('navigation: clicking Books link goes to books page', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-shortcut="books_view"]').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/books$/);
    await expect(page).toHaveTitle(/Books/);
  });

  test('header search box navigates to search results', async ({ page }) => {
    await page.goto('/');
    await page.fill('#header-search-box-input', 'page');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/search/);
    await expect(page).toHaveTitle(/Search/);
  });

  test('favourites page accessible', async ({ page }) => {
    // Navigate to favourites directly
    await page.goto('/favourites');
    await expect(page).toHaveTitle(/My Favourites/);
  });
});
