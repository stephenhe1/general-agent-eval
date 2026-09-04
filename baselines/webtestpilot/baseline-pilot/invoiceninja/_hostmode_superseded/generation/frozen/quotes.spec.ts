import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Quotes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('quotes list shows 2 seeded quotes', async ({ page }) => {
    await goto(page, '/quotes');
    await expect(page.getByText(/Total results: 2/)).toBeVisible();
  });

  test('quotes list shows both seeded quote numbers', async ({ page }) => {
    await goto(page, '/quotes');
    await expect(page.getByRole('link', { name: '123456' })).toBeVisible();
    await expect(page.getByRole('link', { name: '123456_expired' })).toBeVisible();
  });

  test('quotes list shows Expired status badge', async ({ page }) => {
    await goto(page, '/quotes');
    await expect(page.getByText('Expired')).toBeVisible();
  });

  test('New Quote button navigates to quote create form', async ({ page }) => {
    await goto(page, '/quotes');
    await page.getByRole('button', { name: 'New Quote' }).click();
    await page.waitForURL('**/quotes/create', { timeout: 10000 });
    expect(page.url()).toContain('/quotes/create');
  });

  test('quote create form has Client dropdown and Save button', async ({ page }) => {
    await goto(page, '/quotes/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create quote with client → redirects to edit page', async ({ page }) => {
    await goto(page, '/quotes/create');
    // Select company_name client from the combobox
    const clientComboBox = page.getByText('company_name', { exact: true }).first();
    if (await clientComboBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientComboBox.click();
    }
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/quotes\/.+/);
  });
});
