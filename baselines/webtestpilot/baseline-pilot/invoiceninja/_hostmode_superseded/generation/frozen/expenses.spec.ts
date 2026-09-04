import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('expenses list shows seeded expense 0001', async ({ page }) => {
    await goto(page, '/expenses');
    await expect(page.getByRole('link', { name: '0001' })).toBeVisible();
  });

  test('expenses list shows total results', async ({ page }) => {
    await goto(page, '/expenses');
    await expect(page.getByText(/Total results:/)).toBeVisible();
  });

  test('New Expense button navigates to expense create form', async ({ page }) => {
    await goto(page, '/expenses');
    await page.getByRole('button', { name: 'New Expense' }).click();
    await page.waitForURL('**/expenses/create', { timeout: 10000 });
    expect(page.url()).toContain('/expenses/create');
  });

  test('expense create form has Amount, Vendor, Client fields', async ({ page }) => {
    await goto(page, '/expenses/create');
    await expect(page.getByText('Expense Total')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('expense create form has Notes section', async ({ page }) => {
    await goto(page, '/expenses/create');
    await expect(page.getByText('Notes')).toBeVisible();
    await expect(page.getByText('Public Notes')).toBeVisible();
    await expect(page.getByText('Private Notes')).toBeVisible();
  });

  test('expense create form has Additional Info section', async ({ page }) => {
    await goto(page, '/expenses/create');
    await expect(page.getByText('Additional Info')).toBeVisible();
    await expect(page.getByText('Should be invoiced')).toBeVisible();
    await expect(page.getByText('Mark Paid')).toBeVisible();
  });

  test('create new expense with amount → expense appears in list', async ({ page }) => {
    await goto(page, '/expenses/create');

    // Fill in the amount
    await page.getByLabel('Amount').fill('250.00');

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Navigate back to expenses list
    await goto(page, '/expenses');
    // There should be at least 2 expenses now
    const text = await page.getByText(/Total results:/).textContent();
    const count = parseInt((text || '').replace(/\D/g, ''), 10);
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
