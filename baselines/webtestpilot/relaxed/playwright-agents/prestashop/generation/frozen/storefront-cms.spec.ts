import { test, expect } from '@playwright/test';

// TC-51 Delivery information CMS page loads
test('TC-51 delivery CMS page shows heading, content, and breadcrumb', async ({ page }) => {
  await page.goto('/content/1-delivery');
  await page.waitForLoadState('domcontentloaded');

  // Page heading reads "Delivery"
  await expect(page.getByRole('heading', { name: /Delivery/i })).toBeVisible();

  // Page body has text content
  const contentArea = page.locator('.page-cms, .cms-page-content, #content-wrapper .page-content');
  await expect(contentArea.first()).toBeVisible();
  const contentText = await contentArea.first().textContent();
  expect(contentText!.trim().length).toBeGreaterThan(10);

  // Breadcrumb includes Delivery
  const breadcrumb = page.locator('.breadcrumb, nav[aria-label="breadcrumb"]');
  await expect(breadcrumb).toContainText(/Delivery/i);
});

// TC-52 404 page for unknown URL
test('TC-52 unknown URL returns 404 page with correct heading and intact navigation', async ({ page }) => {
  const response = await page.goto('/this-url-does-not-exist-at-all');

  // HTTP status should be 404
  expect(response?.status()).toBe(404);

  // Page heading for not-found
  await expect(page.getByText(/The page you are looking for was not found/i)).toBeVisible();

  // Navigation header should still be rendered
  const header = page.locator('#header, header, .header-top').first();
  await expect(header).toBeVisible();

  // Footer should still be rendered (may be below fold)
  const footer = page.locator('footer').first();
  await expect(footer).toBeAttached();
});
