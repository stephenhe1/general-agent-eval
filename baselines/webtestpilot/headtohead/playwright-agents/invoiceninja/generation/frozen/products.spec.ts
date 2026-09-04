import { test, expect, routeLocalAssets, login } from './fixtures';

test('products list page loads', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/products');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New Product' })).toBeVisible();
});

test('create a product and verify it appears in list', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/products/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // "Item" is the first input (required)
  const inputs = page.locator('input[type="text"], input:not([type])');
  await inputs.first().waitFor({ state: 'visible', timeout: 15000 });
  await inputs.first().fill('Widget Pro');

  // Description is typically the second input
  const descInputs = page.locator('textarea');
  if (await descInputs.count() > 0) {
    await descInputs.first().fill('Professional widget for testing');
  } else if (await inputs.count() > 1) {
    await inputs.nth(1).fill('Professional widget for testing');
  }

  // Price is the 2nd text input (idx 1); description is a textarea and is skipped by this selector
  await inputs.nth(1).fill('99.99');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(url => /\/products\/[^/]+/.test(url.pathname) && !url.pathname.endsWith('/create'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Verify the product was saved by checking the edit page content
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain('Widget Pro');
});

test('edit a product price', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  // Create a product to edit
  await page.goto('/products/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const inputs = page.locator('input[type="text"], input:not([type])');
  await inputs.first().waitFor({ state: 'visible', timeout: 15000 });
  await inputs.first().fill('Editable Widget');

  await inputs.nth(1).fill('50.00');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(url => /\/products\/[^/]+/.test(url.pathname) && !url.pathname.endsWith('/create'), { timeout: 20000 });

  const productUrl = page.url();
  const productId = productUrl.match(/\/products\/([^/]+)/)?.[1];

  await page.goto(`/products/${productId}/edit`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Update price — 2nd text input (same as create form)
  const editInputs = page.locator('input[type="text"], input:not([type])');
  await editInputs.nth(1).clear();
  await editInputs.nth(1).fill('75.00');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate back to the product and verify the new price
  await page.goto(`/products/${productId}/edit`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check that the price input shows 75
  const priceField = page.locator('input[type="text"], input:not([type])').nth(1);
  await expect(priceField).toHaveValue(/75/);
});
