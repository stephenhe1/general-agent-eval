import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Vendors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('vendors list page loads', async ({ page }) => {
    await goto(page, '/vendors');
    await expect(page.getByRole('heading', { name: 'Vendors' })).toBeVisible();
  });

  test('vendors list shows New Vendor button', async ({ page }) => {
    await goto(page, '/vendors');
    await expect(page.getByRole('button', { name: 'New Vendor' })).toBeVisible();
  });

  test('New Vendor button navigates to create form', async ({ page }) => {
    await goto(page, '/vendors');
    await page.getByRole('button', { name: 'New Vendor' }).click();
    await page.waitForURL('**/vendors/create', { timeout: 10000 });
    expect(page.url()).toContain('/vendors/create');
  });

  test('vendor create form has Name and Contacts section', async ({ page }) => {
    await goto(page, '/vendors/create');
    await expect(page.getByText('Details')).toBeVisible();
    await expect(page.getByText('Contacts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create new vendor → vendor appears in list', async ({ page }) => {
    const vendorName = unique('Vendor');
    await goto(page, '/vendors/create');

    await page.getByLabel('Name').fill(vendorName);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await goto(page, '/vendors');
    await expect(page.getByRole('link', { name: vendorName })).toBeVisible();
  });
});
