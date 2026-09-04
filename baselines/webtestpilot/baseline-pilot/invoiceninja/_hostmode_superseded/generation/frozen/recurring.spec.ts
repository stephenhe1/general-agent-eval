import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Recurring Invoices', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('recurring invoices list shows seeded invoice 123456', async ({ page }) => {
    await goto(page, '/recurring_invoices');
    await expect(page.getByRole('link', { name: '123456' })).toBeVisible();
  });

  test('recurring invoices list shows total results', async ({ page }) => {
    await goto(page, '/recurring_invoices');
    await expect(page.getByText(/Total results:/)).toBeVisible();
  });

  test('New Recurring Invoice button navigates to create form', async ({ page }) => {
    await goto(page, '/recurring_invoices');
    await page.getByRole('button', { name: 'New Recurring Invoice' }).click();
    await page.waitForURL('**/recurring_invoices/create', { timeout: 10000 });
    expect(page.url()).toContain('/recurring_invoices/create');
  });

  test('recurring invoice create form has Client and Save button', async ({ page }) => {
    await goto(page, '/recurring_invoices/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});

test.describe('Recurring Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('recurring expenses list page loads', async ({ page }) => {
    await goto(page, '/recurring_expenses');
    await expect(page.getByRole('heading', { name: 'Recurring Expenses' })).toBeVisible();
  });

  test('New Recurring Expense button navigates to create form', async ({ page }) => {
    await goto(page, '/recurring_expenses');
    await page.getByRole('button', { name: 'New Recurring Expense' }).click();
    await page.waitForURL('**/recurring_expenses/create', { timeout: 10000 });
    expect(page.url()).toContain('/recurring_expenses/create');
  });

  test('recurring expense create form loads', async ({ page }) => {
    await goto(page, '/recurring_expenses/create');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
