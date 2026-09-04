import { test, expect } from '@playwright/test';
import { gql } from './helpers';

test.describe('Dashboard', () => {
  test('dashboard page loads with list counts', async ({ page }) => {
    // Get the real counts from the API first
    const data = await gql('{ authorsCount postsCount }');
    const authorCount = data.authorsCount as number;
    const postCount = data.postsCount as number;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Heading
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Verify Authors count card – exact text
    await expect(page.getByText(`${authorCount} items`, { exact: true })).toBeVisible();
    // Verify Posts count card – exact text
    await expect(page.getByText(`${postCount} items`, { exact: true })).toBeVisible();
  });

  test('dashboard links navigate to list pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Authors link in the dashboard cards
    await page.getByRole('link', { name: 'Authors' }).first().click();
    await expect(page).toHaveURL(/\/authors/);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Posts link
    await page.getByRole('link', { name: 'Posts' }).first().click();
    await expect(page).toHaveURL(/\/posts/);
  });
});
