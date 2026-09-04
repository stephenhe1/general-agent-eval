import { test, expect } from '@playwright/test';
import { login, goto, unique } from './helpers';

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('clients list shows seeded client "company_name"', async ({ page }) => {
    await goto(page, '/clients');
    await expect(page.getByRole('link', { name: 'company_name' })).toBeVisible();
  });

  test('clients list shows correct balance for seeded client', async ({ page }) => {
    await goto(page, '/clients');
    await expect(page.getByText('$ 120,000.00').first()).toBeVisible();
  });

  test('clients list shows total results count of 1', async ({ page }) => {
    await goto(page, '/clients');
    await expect(page.getByText(/Total results: 1/)).toBeVisible();
  });

  test('clients list shows contact email', async ({ page }) => {
    await goto(page, '/clients');
    await expect(page.getByText('email@example.com')).toBeVisible();
  });

  test('New Client button navigates to create form', async ({ page }) => {
    await goto(page, '/clients');
    await page.getByRole('button', { name: 'New Client' }).click();
    await page.waitForURL('**/clients/create', { timeout: 10000 });
    expect(page.url()).toContain('/clients/create');
  });

  test('create client form has required fields', async ({ page }) => {
    await goto(page, '/clients/create');
    await expect(page.getByText('Company Details')).toBeVisible();
    await expect(page.getByText('Contacts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('create new client → client appears in list', async ({ page }) => {
    const clientName = unique('TestClient');
    await goto(page, '/clients/create');

    // Fill Name field in the Company Details section
    await page.getByLabel('Name').fill(clientName);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Navigate to clients list and verify the new client is listed
    await goto(page, '/clients');
    await expect(page.getByRole('link', { name: clientName })).toBeVisible();
  });

  test('clicking client row opens client detail view', async ({ page }) => {
    await goto(page, '/clients');
    await page.getByRole('link', { name: 'company_name' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Should navigate to a client detail/edit page
    expect(page.url()).toMatch(/\/clients\/.+/);
  });

  test('filter input narrows client list', async ({ page }) => {
    await goto(page, '/clients');
    // Type a non-existent name in the filter box
    await page.getByPlaceholder('Filter').fill('xyznonexistent123');
    await page.waitForTimeout(800);
    // The seeded client should no longer be visible
    await expect(page.getByRole('link', { name: 'company_name' })).not.toBeVisible();
  });

  test('client create page has Settings and Documents tabs', async ({ page }) => {
    await goto(page, '/clients/create');
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Documents' })).toBeVisible();
  });
});
