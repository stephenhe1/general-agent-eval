import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Bank Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('transactions list page loads', async ({ page }) => {
    await goto(page, '/transactions');
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  });

  test('transactions list shows New Transaction button', async ({ page }) => {
    await goto(page, '/transactions');
    await expect(page.getByRole('button', { name: 'New Transaction' })).toBeVisible();
  });

  test('New Transaction button navigates to create form', async ({ page }) => {
    await goto(page, '/transactions');
    await page.getByRole('button', { name: 'New Transaction' }).click();
    await page.waitForURL('**/transactions/create', { timeout: 10000 });
    expect(page.url()).toContain('/transactions/create');
  });

  test('transaction create form loads with Save button', async ({ page }) => {
    await goto(page, '/transactions/create');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
