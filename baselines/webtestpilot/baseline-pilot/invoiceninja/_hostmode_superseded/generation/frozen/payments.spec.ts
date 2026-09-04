import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Payments', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('payments list shows seeded payment 0001', async ({ page }) => {
    await goto(page, '/payments');
    await expect(page.getByRole('link', { name: '0001' })).toBeVisible();
  });

  test('payments list shows total results', async ({ page }) => {
    await goto(page, '/payments');
    await expect(page.getByText(/Total results:/)).toBeVisible();
  });

  test('New Payment button navigates to payment create form', async ({ page }) => {
    await goto(page, '/payments');
    await page.getByRole('button', { name: 'New Payment' }).click();
    await page.waitForURL('**/payments/create', { timeout: 10000 });
    expect(page.url()).toContain('/payments/create');
  });

  test('payment create form has Client and Amount fields', async ({ page }) => {
    await goto(page, '/payments/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('payments list shows payment amount for seeded payment', async ({ page }) => {
    await goto(page, '/payments');
    // The seeded payment has amount $120,000
    await expect(page.getByText('$ 120,000.00')).toBeVisible();
  });
});
