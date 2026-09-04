import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goto(page, '/reports');
  });

  test('reports page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('reports page has Report type dropdown defaulting to Activity', async ({ page }) => {
    await expect(page.getByText('Report')).toBeVisible();
    await expect(page.getByText('Activity')).toBeVisible();
  });

  test('reports page has Range dropdown defaulting to All', async ({ page }) => {
    await expect(page.getByText('Range')).toBeVisible();
    await expect(page.getByText('All')).toBeVisible();
  });

  test('reports page has Export button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  });

  test('reports page has Send Email toggle', async ({ page }) => {
    await expect(page.getByText('Send Email')).toBeVisible();
  });
});
