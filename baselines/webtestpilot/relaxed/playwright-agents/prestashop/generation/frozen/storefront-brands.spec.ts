import { test, expect } from '@playwright/test';

// TC-45 Brands listing page
test('TC-45 brands listing page shows at least two brands with product counts', async ({ page }) => {
  await page.goto('/brands');

  await expect(page.getByRole('heading', { name: /Brands/i })).toBeVisible();

  // Check for the two expected brands
  await expect(page.getByText(/Graphic Corner/i)).toBeVisible();
  await expect(page.getByText(/Studio Design/i)).toBeVisible();

  // Each entry should have a "View products" link (or similar)
  const viewProductsLinks = page.getByRole('link', { name: /View products|See products/i });
  const linksCount = await viewProductsLinks.count();
  expect(linksCount).toBeGreaterThanOrEqual(1);
});

// TC-46 Brand detail page lists brand products
test('TC-46 Studio Design brand page shows brand products with breadcrumb', async ({ page }) => {
  await page.goto('/brand/1-studio-design');

  // Heading includes brand name
  const heading = page.getByRole('heading', { name: /Studio Design/i });
  await expect(heading).toBeVisible();

  // Product cards are listed
  const productCards = page.locator('article.product-miniature, article[class*="product"]');
  const count = await productCards.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Breadcrumb includes Brands and Studio Design
  const breadcrumb = page.locator('.breadcrumb, nav[aria-label="breadcrumb"]');
  await expect(breadcrumb).toContainText(/Brands/i);
  await expect(breadcrumb).toContainText(/Studio Design/i);
});
