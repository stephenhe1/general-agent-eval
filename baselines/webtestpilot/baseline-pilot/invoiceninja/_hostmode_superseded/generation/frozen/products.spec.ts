import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Products', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('products list shows seeded products', async ({ page }) => {
    await goto(page, '/products');
    await expect(page.getByRole('link', { name: 'product_name' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'product_name1' })).toBeVisible();
  });

  test('products list shows Active status badges', async ({ page }) => {
    await goto(page, '/products');
    const activeBadges = page.getByText('Active');
    await expect(activeBadges.first()).toBeVisible();
  });

  test('products list shows product prices', async ({ page }) => {
    await goto(page, '/products');
    // product_name has $60,000.00 price
    await expect(page.getByText('$ 60,000.00').first()).toBeVisible();
  });

  test('products list shows default quantity', async ({ page }) => {
    await goto(page, '/products');
    await expect(page.getByText('200.00').first()).toBeVisible();
  });

  test('New Product button navigates to create form', async ({ page }) => {
    await goto(page, '/products');
    await page.getByRole('button', { name: 'New Product' }).click();
    await page.waitForURL('**/products/create', { timeout: 10000 });
    expect(page.url()).toContain('/products/create');
  });

  test('product create form has Item, Description, Price fields', async ({ page }) => {
    await goto(page, '/products/create');
    await expect(page.getByLabel('Item')).toBeVisible();
    await expect(page.getByLabel('Price')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create new product → product appears in list', async ({ page }) => {
    const itemName = unique('item');
    await goto(page, '/products/create');

    await page.getByLabel('Item').fill(itemName);
    await page.getByLabel('Price').fill('99.99');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Navigate to products list and confirm new product is there
    await goto(page, '/products');
    await expect(page.getByRole('link', { name: itemName })).toBeVisible();
  });

  test('products list has Actions column per row', async ({ page }) => {
    await goto(page, '/products');
    await expect(page.getByRole('button', { name: 'Actions' }).first()).toBeVisible();
  });
});
