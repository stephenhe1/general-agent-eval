import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('My Account', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('my account profile page loads', async ({ page }) => {
    await page.goto('/my-account/profile');
    await expect(page).toHaveTitle(/Profile Details/);
    await expect(page.locator('[name="name"]')).toBeVisible();
    await expect(page.locator('[name="email"]')).toBeVisible();
  });

  test('my account profile has tab navigation', async ({ page }) => {
    await page.goto('/my-account/profile');
    // Should see links to other account sections
    await expect(page.getByRole('link', { name: /Profile/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Access|Security/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Shortcut/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Notification/i }).first()).toBeVisible();
  });

  test('access & security page loads', async ({ page }) => {
    await page.goto('/my-account/auth');
    await expect(page).toHaveTitle(/Access.*Security|Security.*Access/i);
  });

  test('UI shortcuts page loads', async ({ page }) => {
    await page.goto('/my-account/shortcuts');
    await expect(page).toHaveTitle(/Shortcut/i);
  });

  test('notification preferences page loads', async ({ page }) => {
    await page.goto('/my-account/notifications');
    await expect(page).toHaveTitle(/Notification/i);
  });

  test('user public profile page loads', async ({ page }) => {
    await page.goto('/user/admin');
    await expect(page).toHaveTitle(/Admin.*BookStack|BookStack/);
    // Should show user info
    await expect(page.getByText(/admin/i).first()).toBeVisible();
  });

  test('update account name - change is reflected', async ({ page }) => {
    await page.goto('/my-account/profile');
    const originalName = await page.inputValue('[name="name"]');

    const newName = 'Admin Updated';
    await page.fill('[name="name"]', newName);
    await page.click('button.button:has-text("Save")');
    await page.waitForLoadState('networkidle');

    // Verify name was updated
    await page.goto('/my-account/profile');
    await expect(page.locator('[name="name"]')).toHaveValue(newName);

    // Restore original name
    await page.fill('[name="name"]', originalName);
    await page.click('button.button:has-text("Save")');
    await page.waitForLoadState('networkidle');
  });
});
