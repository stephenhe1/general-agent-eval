import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('My Account', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('profile details page loads with name and email fields', async ({ page }) => {
    await page.goto('/my-account');
    await expect(page).toHaveTitle(/Profile/);
    await expect(page.getByRole('heading', { name: /Profile/i }).first()).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('profile page shows current admin email', async ({ page }) => {
    await page.goto('/my-account/profile');
    await expect(page.locator('#email')).toHaveValue('admin@admin.com');
  });

  test('notification preferences page loads', async ({ page }) => {
    await page.goto('/my-account/notifications');
    await expect(page).toHaveTitle(/Notification/);
    await expect(page.getByRole('heading', { name: /Notification/i })).toBeVisible();
  });

  test('shortcuts preferences page loads', async ({ page }) => {
    await page.goto('/my-account/shortcuts');
    await expect(page).toHaveTitle(/Shortcut/);
    await expect(page.getByRole('heading', { name: /Shortcut/i })).toBeVisible();
  });

  test('public user profile page loads', async ({ page }) => {
    await page.goto('/user/admin');
    await expect(page).toHaveTitle(/Admin/);
    const content = await page.content();
    expect(content).toContain('Admin');
  });

  test('profile name update persists after save', async ({ page }) => {
    await page.goto('/my-account/profile');
    // Read original name
    const originalName = await page.locator('#name').inputValue();

    // Set a new test name
    await page.locator('#name').fill('Admin Updated Name');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Reload and verify new name persisted
    await page.goto('/my-account/profile');
    await expect(page.locator('#name')).toHaveValue('Admin Updated Name');

    // Restore original name
    await page.locator('#name').fill(originalName);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
  });
});
