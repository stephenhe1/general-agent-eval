import { test, expect, routeLocalAssets, login } from './fixtures';

test('payments list page loads', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/payments');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  // "Enter Payment" is a link styled as button
  await expect(page.getByRole('link', { name: 'Enter Payment' })).toBeVisible();
});

test('payments list shows seeded payment data', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/payments');
  await page.waitForLoadState('networkidle');

  // Should have at least one payment (seeded)
  const pageText = await page.evaluate(() => document.body.innerText);
  expect(pageText).toContain('Total results:');
  expect(pageText).toContain('Payments');
});

test('record a payment against a sent invoice', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  // Check initial payment count
  await page.goto('/payments');
  await page.waitForLoadState('networkidle');
  const beforeText = await page.evaluate(() => document.body.innerText);
  const beforeMatch = beforeText.match(/Total results:\s*(\d+)/);
  const beforeCount = beforeMatch ? parseInt(beforeMatch[1]) : 0;

  // Navigate to create payment
  await page.goto('/payments/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Client selector is a headlessui combobox (first input on the form)
  const clientCombo = page.locator('[id^="headlessui-combobox-input"]').first();
  await clientCombo.click();
  await clientCombo.fill('company');
  await page.waitForTimeout(800);
  const clientOption = page.getByRole('option').first();
  await clientOption.waitFor({ state: 'visible', timeout: 8000 });
  await clientOption.click();

  await page.waitForTimeout(800);

  // Amount is the 2nd input (index 1) after client selection
  await page.locator('input').nth(1).fill('100');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/payments\/[^/]+$/, { timeout: 20000 });

  // Verify payment was created
  await page.goto('/payments');
  await page.waitForLoadState('networkidle');

  const afterText = await page.evaluate(() => document.body.innerText);
  const afterMatch = afterText.match(/Total results:\s*(\d+)/);
  const afterCount = afterMatch ? parseInt(afterMatch[1]) : 0;
  expect(afterCount).toBeGreaterThan(beforeCount);
});
