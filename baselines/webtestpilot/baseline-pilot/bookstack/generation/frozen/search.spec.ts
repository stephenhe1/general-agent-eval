import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('search results page renders for a query', async ({ page }) => {
    await page.goto('/search?term=page');
    await expect(page).toHaveTitle(/Search/);
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
  });

  test('search returns results for known content', async ({ page }) => {
    await page.goto('/search?term=Book1');
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
    // "Book1" should appear in the results
    await expect(page.getByText('Book1').first()).toBeVisible();
  });

  test('search from header input navigates to search results', async ({ page }) => {
    await page.goto('/');
    const searchInput = page.locator('#header-search-box-input');
    await searchInput.fill('page');
    await searchInput.press('Enter');
    await page.waitForURL(/\/search/);
    await expect(page).toHaveURL(/search.*term=page/);
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
  });

  test('search with no results shows search results heading', async ({ page }) => {
    await page.goto('/search?term=xyznonexistentcontent12345');
    await expect(page).toHaveTitle(/Search/);
    // Page should show the heading even with no results
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
    // There should be no entity items in the results
    const resultItems = await page.locator('.entity-list-item, [class*="entity-item"]').count();
    expect(resultItems).toBe(0);
  });

  test('search with tag filter returns results', async ({ page }) => {
    await page.goto('/search?term=%5BSample+Tag%5D');
    await expect(page).toHaveTitle(/Search/);
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
  });

  test('tags page shows all tags from seeded data', async ({ page }) => {
    await page.goto('/tags');
    await expect(page).toHaveTitle(/Tags/);
    await expect(page.getByRole('heading', { name: 'Tags', exact: true })).toBeVisible();
    // Seeded data has "Sample Tag" tag
    await expect(page.getByText(/Sample Tag/i)).toBeVisible();
  });

  test('clicking a tag on tags page navigates to tagged search results', async ({ page }) => {
    await page.goto('/tags');
    // Click the "Sample Tag" link
    const tagLink = page.getByRole('link', { name: /Sample Tag/i }).first();
    await tagLink.click();
    await page.waitForURL(/\/search/);
    await expect(page).toHaveURL(/search.*Sample/);
    await expect(page.getByRole('heading', { name: 'Search Results', exact: true })).toBeVisible();
  });
});
