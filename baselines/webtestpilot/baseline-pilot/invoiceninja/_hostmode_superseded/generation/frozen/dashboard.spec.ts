import { test, expect } from '@playwright/test';
import { login, goto } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await goto(page, '/dashboard');
  });

  test('dashboard page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Recent Transactions section is displayed', async ({ page }) => {
    await expect(page.getByText('Recent Transactions')).toBeVisible();
    await expect(page.getByText('Invoices')).toBeVisible();
    await expect(page.getByText('Payments')).toBeVisible();
    await expect(page.getByText('Expenses')).toBeVisible();
    await expect(page.getByText('Outstanding')).toBeVisible();
  });

  test('Overview chart section is displayed', async ({ page }) => {
    await expect(page.getByText('Overview')).toBeVisible();
  });

  test('Day / Week / Month toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Day' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
  });

  test('USD currency selector is visible', async ({ page }) => {
    await expect(page.getByText('USD')).toBeVisible();
  });

  test('Recent Activity section is present', async ({ page }) => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
  });

  test('Recent Payments section is present', async ({ page }) => {
    await expect(page.getByText('Recent Payments')).toBeVisible();
  });

  test('Total Invoices Outstanding metric is displayed', async ({ page }) => {
    await expect(page.getByText('Total Invoices Outstanding')).toBeVisible();
  });
});
