import { test, expect, routeLocalAssets, login } from './fixtures';

test('dashboard shows financial overview widgets', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  // Key widget labels should be present
  await expect(page.getByText('Invoices').first()).toBeVisible();
  await expect(page.getByText('Payments').first()).toBeVisible();
  await expect(page.getByText('Expenses').first()).toBeVisible();
  await expect(page.getByText('Outstanding').first()).toBeVisible();
});

test('dashboard sidebar navigation lists main sections', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  const expectedLinks = ['Clients', 'Invoices', 'Payments', 'Quotes', 'Expenses', 'Products'];
  for (const name of expectedLinks) {
    await expect(page.getByRole('link', { name }).first()).toBeVisible();
  }
});

test('dashboard shows recent transactions section', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await expect(page.getByText('Recent Transactions')).toBeVisible();
  // Currency values should be shown
  await expect(page.getByText('$ 0.00').first()).toBeVisible();
});
