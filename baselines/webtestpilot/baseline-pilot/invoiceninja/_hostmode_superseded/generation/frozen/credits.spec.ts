import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Credits', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('credits list shows seeded credit 123456', async ({ page }) => {
    await goto(page, '/credits');
    await expect(page.getByRole('link', { name: '123456' })).toBeVisible();
  });

  test('credits list shows total results', async ({ page }) => {
    await goto(page, '/credits');
    await expect(page.getByText(/Total results:/)).toBeVisible();
  });

  test('New Credit button navigates to credit create form', async ({ page }) => {
    await goto(page, '/credits');
    await page.getByRole('button', { name: 'New Credit' }).click();
    await page.waitForURL('**/credits/create', { timeout: 10000 });
    expect(page.url()).toContain('/credits/create');
  });

  test('credit create form has Client and Save button', async ({ page }) => {
    await goto(page, '/credits/create');
    await expect(page.getByText('Client')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
