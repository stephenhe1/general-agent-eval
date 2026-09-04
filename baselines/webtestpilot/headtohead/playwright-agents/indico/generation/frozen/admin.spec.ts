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

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Access Admin Settings Page', async ({ page }) => {
    // Navigate to admin settings
    await page.goto('/admin/settings/');
    await page.waitForLoadState('domcontentloaded');

    // Admin settings page should load - page title should contain "General Settings"
    await expect(page).toHaveTitle(/General Settings/i);
    // "General Settings" nav link should be highlighted as active
    await expect(page.getByRole('link', { name: 'General Settings' })).toBeVisible();
  });

  test('Admin Navigation Links Are Present', async ({ page }) => {
    // Navigate to admin area
    await page.goto('/admin/settings/');
    await page.waitForLoadState('domcontentloaded');

    // Key admin navigation items should be present in the side menu
    await expect(page.getByRole('link', { name: 'General Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Plugins' })).toBeVisible();
    // Room booking appears in both header and admin sidebar - check the sidebar specifically
    await expect(page.locator('.side-menu').getByRole('link', { name: /Room booking/i })).toBeVisible();
  });

  test('Search Users in Admin Panel', async ({ page }) => {
    // Navigate to admin users
    await page.goto('/admin/users/');
    await page.waitForLoadState('domcontentloaded');

    // Users page should load with search form
    await expect(page).toHaveTitle(/Users/i);
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();

    // Search for admin user by last name
    await page.locator('#last_name').fill('User');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Admin User should appear in results
    await expect(page.getByRole('link', { name: 'Admin User' })).toBeVisible({ timeout: 10000 });
  });

  test('View Admin User Profile from Admin Panel', async ({ page }) => {
    // Navigate to admin users search
    await page.goto('/admin/users/');
    await page.waitForLoadState('domcontentloaded');

    // Search for admin user by email
    await page.locator('#email').fill('admin@admin.com');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Admin User link should appear
    const adminUserLink = page.getByRole('link', { name: 'Admin User' });
    await expect(adminUserLink).toBeVisible({ timeout: 10000 });

    // Click to view profile
    await adminUserLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Profile page should show the user's profile title in the page title
    await expect(page).toHaveTitle(/Profile of Admin User/i);
  });
});
