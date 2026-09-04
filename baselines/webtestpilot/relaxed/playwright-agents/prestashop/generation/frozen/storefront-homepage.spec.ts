import { test, expect } from '@playwright/test';

// TC-01 Homepage renders key structural elements
test('TC-01 homepage renders key structural elements', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/PrestaShop/);

  // Header logo
  const logo = page.locator('#header .logo, header .logo, .header-logo img, #_desktop_logo img').first();
  await expect(logo).toBeVisible();

  // Top nav links
  await expect(page.getByRole('link', { name: 'Clothes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Accessories' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Art' })).toBeVisible();

  // Hero carousel / slider
  const carousel = page.locator('.carousel, #carousel, [id*="carousel"], .slider, [class*="slider"]').first();
  await expect(carousel).toBeVisible();

  // Featured products section with at least one product card
  const productCards = page.locator('article.product-miniature, .product-miniature article, article[class*="product"]');
  await expect(productCards.first()).toBeVisible();
  await expect(productCards).toHaveCount(await productCards.count() >= 1 ? await productCards.count() : 1);

  // Footer links
  await expect(page.getByRole('link', { name: /Delivery/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Legal Notice/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Terms and Conditions/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /About us/i })).toBeVisible();
});

// TC-02 Homepage hero links navigate to product pages
test('TC-02 homepage featured product link navigates to product detail page', async ({ page }) => {
  await page.goto('/');

  // Click first linked product thumbnail in the featured-products block
  const productLink = page.locator('.featured-products a.thumbnail, .featured-products .product-title a, [id*="featured"] a.product-title, .products article a.thumbnail').first();
  await productLink.click();

  await page.waitForLoadState('domcontentloaded');

  // Should land on a product detail page
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toBeVisible();

  const addToCartBtn = page.getByRole('button', { name: /Add to Cart/i });
  await expect(addToCartBtn).toBeVisible();
});
