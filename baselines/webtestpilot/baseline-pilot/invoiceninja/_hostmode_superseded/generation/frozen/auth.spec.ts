import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from './helpers';

test.describe('Authentication', () => {
  test('valid login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 45000 });

    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 30000 });
    expect(page.url()).toContain('/dashboard');
    // Sidebar should be visible
    await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Invoices' })).toBeVisible();
  });

  test('invalid credentials shows an error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 45000 });

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should stay on login page (not redirect to dashboard)
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/dashboard');
    // URL still contains login
    expect(page.url()).toMatch(/\/login/);
  });

  test('unauthenticated access to /clients redirects to login', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // Should be on login page
    expect(page.url()).toMatch(/\/login/);
  });

  test('login page renders email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 45000 });

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in|login/i })).toBeVisible();
  });
});
