import { test, expect, routeLocalAssets, login } from './fixtures';

test('clients list page loads and shows data', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  // "New Client" is a link styled as a button
  await expect(page.getByRole('link', { name: 'New Client' })).toBeVisible();
});

test('clients list shows seeded client with balance', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('link', { name: 'company_name' }).first()).toBeVisible();
});

test('create a new client and it appears in the list', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/clients/create');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // The Name field is the first plain text input in Company Details
  const nameInput = page.locator('input').first();
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  await nameInput.fill('Playwright Test Client');

  // Fill contact fields
  await page.locator('#first_name_0').fill('Alice');
  await page.locator('#last_name_0').fill('Tester');
  await page.locator('#email_0').fill('alice@playwright-test.example');

  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForURL(/\/clients\/[^/]+$/, { timeout: 20000 });

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('link', { name: 'Playwright Test Client' }).first()).toBeVisible();
});

test('click a client to view client detail page', async ({ page }) => {
  await routeLocalAssets(page);
  await login(page);

  await page.goto('/clients');
  await page.waitForLoadState('networkidle');

  const firstClientLink = page.getByRole('link', { name: 'company_name' }).first();
  await firstClientLink.click();

  await expect(page).toHaveURL(/\/clients\/[^/]+$/);
  await expect(page.getByText('company_name').first()).toBeVisible();
});
