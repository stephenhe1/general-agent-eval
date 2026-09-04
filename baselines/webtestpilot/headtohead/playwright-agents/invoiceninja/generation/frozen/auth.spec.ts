import { test, expect, routeLocalAssets } from './fixtures';

test('login with valid credentials navigates to dashboard', async ({ page }) => {
  await routeLocalAssets(page);
  await page.goto('/login');

  const emailInput = page.locator('input[name="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await emailInput.fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await expect(page).toHaveURL(/\/dashboard/);
  // Sidebar nav should show Dashboard link
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
});

test('login page shows email and password fields', async ({ page }) => {
  await routeLocalAssets(page);
  await page.goto('/login');

  const emailInput = page.locator('input[name="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20000 });
  await expect(emailInput).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
});
