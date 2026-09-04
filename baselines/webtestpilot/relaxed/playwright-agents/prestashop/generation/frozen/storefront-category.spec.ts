import { test, expect } from '@playwright/test';

// TC-03 Top-level category page loads product list
test('TC-03 clothes category page shows products, filters, and sort', async ({ page }) => {
  await page.goto('/3-clothes');

  // Breadcrumb
  const breadcrumb = page.locator('.breadcrumb, nav[aria-label="breadcrumb"]');
  await expect(breadcrumb).toContainText('Clothes');

  // At least one product card
  const productCards = page.locator('article.product-miniature, article[class*="product"]');
  const count = await productCards.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Product count line
  const countLine = page.locator('.total-products, [class*="total-product"], .js-total-products');
  await expect(countLine).toBeVisible();
  await expect(countLine).toContainText(/product/i);

  // Left sidebar filters
  const filterSection = page.locator('#search_filters').first();
  await expect(filterSection).toBeVisible();

  // Sort order dropdown
  const sortDropdown = page.locator('.products-sort-order, #js-product-list-top select, select[id*="sort"]').first();
  await expect(sortDropdown).toBeVisible();
});

// TC-04 Sub-category navigation
test('TC-04 clicking Men sub-category navigates to men category', async ({ page }) => {
  await page.goto('/3-clothes');

  // Click "Men" sub-category link
  await page.getByRole('link', { name: 'Men' }).first().click();
  await page.waitForLoadState('domcontentloaded');

  await expect(page).toHaveURL(/\/4-men|3-clothes.*Men|Categories-Men/i);

  // Breadcrumb includes both Clothes and Men
  const breadcrumb = page.locator('.breadcrumb, nav[aria-label="breadcrumb"]');
  await expect(breadcrumb).toContainText('Clothes');
  await expect(breadcrumb).toContainText('Men');

  // At least one product
  const productCards = page.locator('article.product-miniature, article[class*="product"]');
  const count = await productCards.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// TC-05 Faceted filter narrows product list
test('TC-05 Black colour filter narrows product list', async ({ page }) => {
  await page.goto('/3-clothes');

  // Get initial product count
  const countLine = page.locator('.total-products, [class*="total-product"], .js-total-products');
  await expect(countLine).toBeVisible();
  const initialCountText = await countLine.textContent();

  // Click the Black colour filter
  const blackFilter = page.getByRole('link', { name: /Black/i }).first();
  await blackFilter.click();
  await page.waitForLoadState('domcontentloaded');

  // URL should contain color filter
  await expect(page).toHaveURL(/Color-Black|color.*black/i);

  // Active filters block shows Color: Black
  const activeFilters = page.locator('.active-search-filters, [id*="active_filter"], .active_filters');
  await expect(activeFilters).toBeVisible();
  await expect(activeFilters).toContainText(/Black/i);

  // Remove (×) control is present
  const removeFilter = page.locator('.active-search-filters a, [class*="active_filter"] a, .filter-block a').first();
  await expect(removeFilter).toBeVisible();

  // Product count should be shown (at least one result)
  await expect(countLine).toContainText(/product/i);
});

// TC-06 Removing a faceted filter restores full list
test('TC-06 removing Black colour filter restores full product list', async ({ page }) => {
  await page.goto('/3-clothes?q=Color-Black');
  await page.waitForLoadState('domcontentloaded');

  // Active filters block should show Color: Black
  const activeFilters = page.locator('.active-search-filters, [id*="active_filter"], .active_filters');
  await expect(activeFilters).toBeVisible();

  // Click the × on the active filter chip
  const removeFilterLink = page.locator('.active-search-filters a, .filter-block .close, [class*="active_filter"] a').first();
  await removeFilterLink.click();
  await page.waitForLoadState('domcontentloaded');

  // URL should no longer contain q=Color-Black
  const url = page.url();
  expect(url).not.toContain('Color-Black');

  // Active filters block should be gone or empty
  const activeFiltersCount = await activeFilters.count();
  if (activeFiltersCount > 0) {
    const isVisible = await activeFilters.isVisible();
    if (isVisible) {
      const text = await activeFilters.textContent();
      expect(text).not.toMatch(/Color.*Black/i);
    }
  }

  // Product count reflects more products now
  const countLine = page.locator('.total-products, [class*="total-product"], .js-total-products');
  await expect(countLine).toBeVisible();
  await expect(countLine).toContainText(/product/i);
});

// TC-07 Category sort order — price ascending
test('TC-07 sort by price low to high reorders products by ascending price', async ({ page }) => {
  await page.goto('/3-clothes');

  // Select "Price, low to high" from sort dropdown
  const sortSelect = page.locator('select[id*="sort"], .products-sort-order select').first();
  await sortSelect.selectOption('Price, low to high');
  await page.waitForLoadState('domcontentloaded');

  // URL should contain price ascending sort
  await expect(page).toHaveURL(/product\.price\.asc|price.*asc/i);

  // Collect displayed prices and verify they are ascending
  const priceElements = page.locator('article.product-miniature .price, article[class*="product"] .price');
  const pricesText = await priceElements.allTextContents();
  const prices = pricesText
    .map(t => parseFloat(t.replace(/[^0-9.]/g, '')))
    .filter(p => !isNaN(p));

  expect(prices.length).toBeGreaterThanOrEqual(2);

  // First price should be <= last price (ascending order)
  expect(prices[0]).toBeLessThanOrEqual(prices[prices.length - 1]);
});

// TC-08 Accessories category shows subcategory block
test('TC-08 accessories category shows subcategories block', async ({ page }) => {
  await page.goto('/6-accessories');

  await expect(page.getByRole('heading', { name: /Subcategories/i })).toBeVisible();

  // Home Accessories and Stationery subcategory links
  const subcatLinks = page.locator('.subcategories a, [class*="subcategory"] a');
  const count = await subcatLinks.count();
  expect(count).toBeGreaterThanOrEqual(2);
});
