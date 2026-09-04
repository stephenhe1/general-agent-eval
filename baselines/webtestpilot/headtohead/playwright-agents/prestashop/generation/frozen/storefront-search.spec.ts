import { test, expect } from '@playwright/test';

// TC-17 Search returns matching products
test('TC-17 searching for t-shirt returns results with count', async ({ page }) => {
  await page.goto('/');

  // Fill search bar and submit
  const searchInput = page.locator('input[name="s"], input[type="search"], #search_query_top').first();
  await searchInput.fill('t-shirt');
  await searchInput.press('Enter');
  await page.waitForLoadState('domcontentloaded');

  // URL contains search term
  await expect(page).toHaveURL(/s=t-shirt|search.*t-shirt/i);

  // Page heading reads "Search results"
  await expect(page.getByRole('heading', { name: /Search results/i })).toBeVisible();

  // At least one product card
  const productCards = page.locator('article.product-miniature, article[class*="product"]');
  const count = await productCards.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Result count line
  const countLine = page.locator('.total-products, [class*="total-product"], .js-total-products');
  await expect(countLine).toBeVisible();
  await expect(countLine).toContainText(/product/i);
});

// TC-18 Search with no results shows empty state
test('TC-18 searching for nonexistent term shows no results state', async ({ page }) => {
  await page.goto('/search?s=xxxxnotexists');

  await expect(page.getByRole('heading', { name: /Search results/i })).toBeVisible();

  // No product articles should be rendered
  const productCards = page.locator('#js-product-list article, article.product-miniature, article[class*="product"]');
  const count = await productCards.count();
  expect(count).toBe(0);

  // "No results" or "0 products" indication
  const noResultsMsg = page.locator(
    '.no-products, [class*="no-result"], .alert:has-text("No products"), .total-products'
  );
  const noResultsVisible = await noResultsMsg.first().isVisible().catch(() => false);
  if (!noResultsVisible) {
    // Some themes show a zero in the total-products text
    const countLine = page.locator('.total-products, [class*="total-product"]');
    if (await countLine.isVisible()) {
      const text = await countLine.textContent();
      expect(text).toMatch(/0|no product/i);
    }
  } else {
    await expect(noResultsMsg.first()).toBeVisible();
  }
});

// TC-19 Search results can be sorted
test('TC-19 search results sorted by name A to Z reorders products alphabetically', async ({ page }) => {
  await page.goto('/search?s=poster');
  await page.waitForLoadState('domcontentloaded');

  // Select "Name, A to Z" from sort dropdown
  const sortSelect = page.locator('select[id*="sort"], .products-sort-order select').first();
  await sortSelect.selectOption('Name, A to Z');
  await page.waitForLoadState('domcontentloaded');

  // URL should contain alphabetical sort
  await expect(page).toHaveURL(/product\.name\.asc|name.*asc/i);

  // Collect product names and verify they are in ascending alphabetical order
  const nameElements = page.locator('article.product-miniature .product-title, article[class*="product"] .product-title');
  const names = await nameElements.allTextContents();
  const trimmedNames = names.map(n => n.trim()).filter(n => n.length > 0);

  if (trimmedNames.length >= 2) {
    const sorted = [...trimmedNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    expect(trimmedNames).toEqual(sorted);
  } else {
    // At least one result needed
    expect(trimmedNames.length).toBeGreaterThanOrEqual(1);
  }
});
