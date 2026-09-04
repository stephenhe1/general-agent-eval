import { test, expect, routeLocalAssets, login } from './fixtures';

test('invoices list page loads with seeded data', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/invoices');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  // Seeded invoice numbers include 123456 variants
  await expect(page.getByRole('link', { name: '123456' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'New Invoice' })).toBeVisible();
});

test('invoices list shows seeded invoice amounts', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/invoices');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('$ 120,000.00').first()).toBeVisible();
  // At least 4 seeded invoices
  const pageText = await page.evaluate(() => document.body.innerText);
  const match = pageText.match(/Total results:\s*(\d+)/);
  if (match) {
    expect(parseInt(match[1])).toBeGreaterThanOrEqual(4);
  }
});

test('create a new invoice and verify total', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/invoices/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Client selector is a headlessui combobox (first input on the form)
  const clientCombo = page.locator('[id^="headlessui-combobox-input"]').first();
  await clientCombo.click();
  await clientCombo.fill('company');
  await page.waitForTimeout(800);
  const option = page.getByRole('option').first();
  await option.waitFor({ state: 'visible', timeout: 8000 });
  await option.click();

  // Add a line item — the table starts empty
  await page.getByText('Add Item').click();
  await page.waitForTimeout(500);

  // After "Add Item", 3 new inputs appear: item(9), unit cost(10), quantity(11)
  await page.locator('input').nth(9).fill('Consulting Services');
  await page.locator('input').nth(10).fill('1000');
  await page.locator('input').nth(10).press('Tab');

  await page.waitForTimeout(800);
  // Total: 1000 × 1 = $1,000
  await expect(page.getByText('$ 1,000.00').first()).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 20000 });
  await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
});

test('new invoice appears in invoice list after creation', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  // Note initial count
  await page.goto('/invoices');
  await page.waitForLoadState('networkidle');
  const beforeText = await page.evaluate(() => document.body.innerText);
  const beforeMatch = beforeText.match(/Total results:\s*(\d+)/);
  const beforeCount = beforeMatch ? parseInt(beforeMatch[1]) : 0;

  // Create an invoice
  await page.goto('/invoices/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const clientCombo = page.locator('[id^="headlessui-combobox-input"]').first();
  await clientCombo.click();
  await clientCombo.fill('company');
  await page.waitForTimeout(800);
  const option = page.getByRole('option').first();
  await option.waitFor({ state: 'visible', timeout: 8000 });
  await option.click();

  await page.getByText('Add Item').click();
  await page.waitForTimeout(500);
  await page.locator('input').nth(9).fill('Test Item');
  await page.locator('input').nth(10).fill('250');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 20000 });

  // Verify count increased
  await page.goto('/invoices');
  await page.waitForLoadState('networkidle');

  const afterText = await page.evaluate(() => document.body.innerText);
  const afterMatch = afterText.match(/Total results:\s*(\d+)/);
  const afterCount = afterMatch ? parseInt(afterMatch[1]) : 0;
  expect(afterCount).toBeGreaterThan(beforeCount);
});
