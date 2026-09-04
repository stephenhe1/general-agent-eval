import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads and shows Authors and Posts list sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page title
    await expect(page).toHaveTitle(/Keystone/);

    // Main heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // "Lists" section heading
    await expect(page.getByRole('heading', { name: 'Lists' })).toBeVisible();

    // Authors and Posts section headings are present
    await expect(page.getByRole('heading', { name: 'Authors', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Posts', level: 3 })).toBeVisible();
  });

  test('dashboard shows item counts for Authors and Posts sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Both list cards show an "items" count
    const allCounts = await page.getByText(/\d+ items/).allTextContents();
    expect(allCounts.length).toBeGreaterThanOrEqual(2);

    // Authors count >= 6 seeded
    const authorCount = parseInt(allCounts[0]);
    expect(authorCount).toBeGreaterThanOrEqual(6);

    // Posts count >= 8 seeded
    const postCount = parseInt(allCounts[1]);
    expect(postCount).toBeGreaterThanOrEqual(8);
  });

  test('clicking Authors sidebar link navigates to authors list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use main nav scope to avoid ambiguity with dashboard cards
    await page.locator('nav[aria-label="main"]').getByRole('link', { name: 'Authors' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/authors/);
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();
  });

  test('clicking Posts sidebar link navigates to posts list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('nav[aria-label="main"]').getByRole('link', { name: 'Posts' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/posts/);
    await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
  });
});
