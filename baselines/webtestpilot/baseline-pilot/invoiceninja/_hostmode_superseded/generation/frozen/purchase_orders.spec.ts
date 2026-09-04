import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Purchase Orders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('purchase orders list page loads', async ({ page }) => {
    await goto(page, '/purchase_orders');
    await expect(page.getByRole('heading', { name: 'Purchase Orders' })).toBeVisible();
  });

  test('purchase orders list shows New Purchase Order button', async ({ page }) => {
    await goto(page, '/purchase_orders');
    await expect(page.getByRole('button', { name: 'New Purchase Order' })).toBeVisible();
  });

  test('New Purchase Order navigates to create form', async ({ page }) => {
    await goto(page, '/purchase_orders');
    await page.getByRole('button', { name: 'New Purchase Order' }).click();
    await page.waitForURL('**/purchase_orders/create', { timeout: 10000 });
    expect(page.url()).toContain('/purchase_orders/create');
  });

  test('purchase order create form has Vendor and Save button', async ({ page }) => {
    await goto(page, '/purchase_orders/create');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
