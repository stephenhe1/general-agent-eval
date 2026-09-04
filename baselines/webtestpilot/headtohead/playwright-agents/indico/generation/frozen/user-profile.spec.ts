// spec: specs/admin-categories-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('webtestpilot');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('User Profile', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('View User Dashboard', async ({ page }) => {
    // Navigate to user dashboard
    await page.goto('/user/dashboard/');
    await page.waitForLoadState('domcontentloaded');

    // Dashboard text should be visible in the breadcrumb/banner area
    await expect(page.getByText('Dashboard', { exact: false }).first()).toBeVisible();
    // User name heading should be visible (Admin User is an h3)
    await expect(page.getByRole('heading', { name: 'Admin User' })).toBeVisible();
    // Admin badge should be visible
    await expect(page.locator('.ui.label').filter({ hasText: 'Admin' }).first()).toBeVisible();
  });

  test('Navigate to User Dashboard via Profile Link', async ({ page }) => {
    // From home, click "My profile" nav link
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: 'My profile' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Should arrive at dashboard
    await expect(page).toHaveURL(/\/user\/dashboard\//);
    // Admin User heading should be visible
    await expect(page.getByRole('heading', { name: 'Admin User' })).toBeVisible();
  });

  test('User Profile Settings Page Accessible', async ({ page }) => {
    // Navigate to user profile/settings
    await page.goto('/user/profile/');
    await page.waitForLoadState('domcontentloaded');

    // Profile settings page should load with "Personal data" nav link active
    await expect(page).not.toHaveURL(/\/login\//);
    await expect(page).toHaveTitle(/My Profile/i);
    // Personal data nav link should be present
    await expect(page.getByRole('link', { name: 'Personal data' })).toBeVisible();
  });
});
