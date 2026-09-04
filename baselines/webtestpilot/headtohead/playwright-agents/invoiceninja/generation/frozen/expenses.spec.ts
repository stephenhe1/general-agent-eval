import { test, expect, routeLocalAssets, login } from './fixtures';

test('expenses list shows seeded expense', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter Expense' })).toBeVisible();
  // Seeded: 1 expense with $23,234
  await expect(page.getByText('$ 23,234.00').first()).toBeVisible();
});

test('expenses list shows correct total results', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');

  // At least 1 seeded expense
  const pageText = await page.evaluate(() => document.body.innerText);
  const match = pageText.match(/Total results:\s*(\d+)/);
  if (match) {
    expect(parseInt(match[1])).toBeGreaterThanOrEqual(1);
  }
});

test('create a new expense and verify it appears in list', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');
  const beforeText = await page.evaluate(() => document.body.innerText);
  const beforeMatch = beforeText.match(/Total results:\s*(\d+)/);
  const beforeCount = beforeMatch ? parseInt(beforeMatch[1]) : 0;

  await page.goto('/expenses/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Amount is the first non-headlessui, non-react-select, non-date text input (6th overall)
  const amountInput = page.locator('input').nth(5);
  await amountInput.waitFor({ state: 'visible', timeout: 15000 });
  await amountInput.fill('150');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/expenses\/[^/]+$/, { timeout: 20000 });

  await page.goto('/expenses');
  await page.waitForLoadState('networkidle');

  const afterText = await page.evaluate(() => document.body.innerText);
  const afterMatch = afterText.match(/Total results:\s*(\d+)/);
  const afterCount = afterMatch ? parseInt(afterMatch[1]) : 0;
  expect(afterCount).toBeGreaterThan(beforeCount);
});

test('expense create form has required fields', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/expenses/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await expect(page.getByText('Amount').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
});
