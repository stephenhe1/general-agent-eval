// spec: specs/keystone-blog-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {

  // NAV-01: Dashboard loads and shows list links
  test('NAV-01: Dashboard loads and shows list links', async ({ page }) => {
    // Step 1: Navigate to the root URL
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert the page heading contains "Dashboard"
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Step 3: Assert the Authors link is present in the nav sidebar
    await expect(page.locator('nav a[href="/authors"]')).toBeVisible();

    // Step 4: Assert the Posts link is present in the nav sidebar
    await expect(page.locator('nav a[href="/posts"]')).toBeVisible();

    // Step 5: Assert there is NO nav link for Tags (Tags is not in the sidebar)
    await expect(page.locator('nav a[href="/tags"]')).toHaveCount(0);
  });

  // NAV-02: Navigate to Authors list via sidebar
  test('NAV-02: Navigate to Authors list via sidebar', async ({ page }) => {
    // Step 1: Navigate to the dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Authors sidebar link (use nav locator to avoid strict mode violation)
    await page.locator('nav a[href="/authors"]').click();
    await page.waitForLoadState('networkidle');

    // Step 3: Assert the URL contains /authors (allows query params appended by the app)
    await expect(page).toHaveURL(/\/authors/);

    // Step 4: Assert the "New author" create link is visible
    await expect(page.locator('a[href="/authors/create"]')).toBeVisible();
  });

  // NAV-03: Navigate to Posts list via sidebar
  test('NAV-03: Navigate to Posts list via sidebar', async ({ page }) => {
    // Step 1: Navigate to the dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Step 2: Click the Posts sidebar link (use nav locator to avoid strict mode violation)
    await page.locator('nav a[href="/posts"]').click();
    await page.waitForLoadState('networkidle');

    // Step 3: Assert the URL contains /posts (allows query params appended by the app)
    await expect(page).toHaveURL(/\/posts/);

    // Step 4: Assert the "New post" create link is visible
    await expect(page.locator('a[href="/posts/create"]')).toBeVisible();
  });

  // NAV-04: Navigate to Tags list via direct URL
  test('NAV-04: Navigate to Tags list via direct URL', async ({ page }) => {
    // Step 1: Navigate directly to /tags
    await page.goto('/tags');
    await page.waitForLoadState('networkidle');

    // Step 2: Assert the URL contains /tags (allows query params appended by the app)
    await expect(page).toHaveURL(/\/tags/);

    // Step 3: Assert the "New tag" create link is visible
    await expect(page.locator('a[href="/tags/create"]')).toBeVisible();
  });

});
