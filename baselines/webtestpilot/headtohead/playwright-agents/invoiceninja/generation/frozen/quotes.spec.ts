import { test, expect, routeLocalAssets, login } from './fixtures';

test('quotes list shows seeded quotes', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New Quote' })).toBeVisible();
  // Seeded data has at least 3 quotes
  const pageText = await page.evaluate(() => document.body.innerText);
  const match = pageText.match(/Total results:\s*(\d+)/);
  if (match) {
    expect(parseInt(match[1])).toBeGreaterThanOrEqual(3);
  }
});

test('quotes list shows seeded quote number and amount', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');

  // Seeded quote 0001 with $60,000
  await expect(page.getByRole('link', { name: '0001' }).first()).toBeVisible();
  await expect(page.getByText('$ 60,000.00').first()).toBeVisible();
});

test('create a new quote and verify total', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/quotes/create');
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

  // Add a line item — table starts empty
  await page.getByText('Add Item').click();
  await page.waitForTimeout(500);

  // After "Add Item": item(9), unit cost(10), quantity(11)
  await page.locator('input').nth(9).fill('Development Work');
  await page.locator('input').nth(10).fill('10000');
  await page.locator('input').nth(10).press('Tab');

  await page.waitForTimeout(800);
  // Total: 10000 × 1 = $10,000
  await expect(page.getByText('$ 10,000.00').first()).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/quotes\/[^/]+$/, { timeout: 20000 });
  await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
});

test('new quote increases quotes count', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');
  const beforeText = await page.evaluate(() => document.body.innerText);
  const beforeMatch = beforeText.match(/Total results:\s*(\d+)/);
  const beforeCount = beforeMatch ? parseInt(beforeMatch[1]) : 0;

  await page.goto('/quotes/create');
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
  await page.locator('input').nth(9).fill('Extra Work');
  await page.locator('input').nth(10).fill('100');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/quotes\/[^/]+$/, { timeout: 20000 });

  await page.goto('/quotes');
  await page.waitForLoadState('networkidle');
  const afterText = await page.evaluate(() => document.body.innerText);
  const afterMatch = afterText.match(/Total results:\s*(\d+)/);
  const afterCount = afterMatch ? parseInt(afterMatch[1]) : 0;
  expect(afterCount).toBeGreaterThan(beforeCount);
});
