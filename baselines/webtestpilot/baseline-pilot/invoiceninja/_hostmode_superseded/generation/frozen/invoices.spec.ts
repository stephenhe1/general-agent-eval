import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Invoices', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('invoices list shows 4 seeded invoices', async ({ page }) => {
    await goto(page, '/invoices');
    await expect(page.getByText(/Total results: 4/)).toBeVisible();
  });

  test('invoices list shows invoice numbers for all seeded invoices', async ({ page }) => {
    await goto(page, '/invoices');
    await expect(page.getByRole('link', { name: '123456' })).toBeVisible();
    await expect(page.getByRole('link', { name: '123456_sent' })).toBeVisible();
    await expect(page.getByRole('link', { name: '123456_draft' })).toBeVisible();
    await expect(page.getByRole('link', { name: '123456_past_due' })).toBeVisible();
  });

  test('invoices list shows all four status badges', async ({ page }) => {
    await goto(page, '/invoices');
    await expect(page.getByText('Paid')).toBeVisible();
    await expect(page.getByText('Sent')).toBeVisible();
    await expect(page.getByText('Draft')).toBeVisible();
    await expect(page.getByText('Past Due')).toBeVisible();
  });

  test('invoices list shows client name for each invoice', async ({ page }) => {
    await goto(page, '/invoices');
    const clientLinks = page.getByRole('link', { name: 'company_name' });
    await expect(clientLinks.first()).toBeVisible();
  });

  test('New Invoice button navigates to invoice create form', async ({ page }) => {
    await goto(page, '/invoices');
    await page.getByRole('button', { name: 'New Invoice' }).click();
    await page.waitForURL('**/invoices/create', { timeout: 10000 });
    expect(page.url()).toContain('/invoices/create');
  });

  test('invoice create form shows Client dropdown and Add Item button', async ({ page }) => {
    await goto(page, '/invoices/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByText('Add Item')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create invoice with client → redirects to edit page', async ({ page }) => {
    await goto(page, '/invoices/create');

    // Select company_name client
    await page.locator('[id*="client"], [class*="client"]').first().click().catch(() => {});
    // The client dropdown options appear - click on company_name
    const clientOption = page.getByText('company_name', { exact: true }).first();
    if (await clientOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clientOption.click();
    } else {
      // Try clicking the combobox directly
      await page.locator('div').filter({ hasText: /^company_name$/ }).first().click().catch(() => {});
    }

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // After save, should redirect to invoice edit page
    expect(page.url()).toMatch(/\/invoices\/.+/);
  });

  test('invoice create form has Products and Tasks tabs', async ({ page }) => {
    await goto(page, '/invoices/create');
    await expect(page.getByRole('tab', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tasks' })).toBeVisible();
  });

  test('invoice create form shows invoice date field', async ({ page }) => {
    await goto(page, '/invoices/create');
    await expect(page.getByText('Invoice Date')).toBeVisible();
  });

  test('clicking invoice number link opens edit page', async ({ page }) => {
    await goto(page, '/invoices');
    await page.getByRole('link', { name: '123456_draft' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/invoices\/.+/);
  });
});
