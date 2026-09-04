import { test, expect, routeLocalAssets, login } from './fixtures';

test('company details settings page loads', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/settings/company_details');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await expect(page.getByRole('heading', { name: 'Company Details' })).toBeVisible();
  await expect(page.getByText('Company Name').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
});

test('update company name persists after save', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/settings/company_details');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Company Name is the first input on the Details tab
  const companyNameInput = page.locator('input').first();
  await companyNameInput.waitFor({ state: 'visible', timeout: 15000 });
  await companyNameInput.clear();
  await companyNameInput.fill('Renamed Company');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1500);

  // The updated company name should appear (in sidebar logo area or breadcrumb)
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).toContain('Renamed Company');
});

test('settings sidebar shows basic and advanced sections', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/settings/company_details');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await expect(page.getByText('BASIC SETTINGS')).toBeVisible();
  await expect(page.getByText('ADVANCED SETTINGS')).toBeVisible();
  // Use getByRole link to avoid strict mode violation with option elements
  await expect(page.getByRole('link', { name: 'User Details' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Localization' })).toBeVisible();
});
