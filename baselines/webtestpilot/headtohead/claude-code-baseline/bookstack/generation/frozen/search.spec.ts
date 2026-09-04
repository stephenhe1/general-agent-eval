import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('search results page shows relevant results', async ({ page }) => {
    await page.goto('/search?term=page');
    await expect(page).toHaveTitle(/Search for page/);
    const results = page.locator('.entity-list-item');
    await expect(results.first()).toBeVisible();
    // Should find multiple results
    expect(await results.count()).toBeGreaterThan(0);
  });

  test('search for exact book name returns that book', async ({ page }) => {
    await page.goto('/search?term=Book1');
    await expect(page).toHaveTitle(/Search/);
    const results = page.locator('.entity-list-item');
    await expect(results.first()).toBeVisible();
  });

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/search?term=xyznonexistentterm12345');
    await expect(page).toHaveTitle(/Search/);
    // BookStack shows "No items available" and "0 total results found" for empty search
    await expect(page.getByText('No items available')).toBeVisible();
  });

  test('header search box navigates to search page', async ({ page }) => {
    await page.goto('/');
    await page.fill('#header-search-box-input', 'Book1');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/search/);
    await expect(page).toHaveTitle(/Search/);
  });

  test('search page with type filter for books', async ({ page }) => {
    await page.goto('/search?term=book&types[]=book');
    await expect(page).toHaveTitle(/Search/);
    const results = page.locator('.entity-list-item');
    await expect(results.first()).toBeVisible();
  });
});
