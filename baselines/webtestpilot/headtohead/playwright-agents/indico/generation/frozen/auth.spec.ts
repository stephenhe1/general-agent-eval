// spec: specs/event-management-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('webtestpilot');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Authentication', () => {
  test('Successful Login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login/');
    // Fill username
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
    // Fill password
    await page.getByRole('textbox', { name: 'Password' }).fill('webtestpilot');
    // Click login button
    await page.getByRole('button', { name: /Login/ }).click();
    await page.waitForLoadState('domcontentloaded');

    // URL should no longer be /login/
    await expect(page).not.toHaveURL(/\/login\//);
    // User profile link should be visible, confirming login
    await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();
  });

  test('Failed Login with Wrong Password', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login/');
    // Fill username
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
    // Fill wrong password
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
    // Click login button
    await page.getByRole('button', { name: /Login/ }).click();
    await page.waitForLoadState('domcontentloaded');

    // URL should stay on login page
    await expect(page).toHaveURL(/\/login\//);
    // Error message box should be visible
    await expect(page.locator('.error-message-box').first()).toBeVisible();
  });

  test('Logout', async ({ page }) => {
    // Log in first
    await login(page);
    // Should be logged in - verify by seeing the Administration link
    await expect(page.getByRole('link', { name: 'Administration' })).toBeVisible();

    // Click the user menu button ("A. User")
    await page.locator('#user-settings-link').click();
    // Click logout link
    await page.getByRole('link', { name: 'Logout' }).click();
    await page.waitForLoadState('domcontentloaded');

    // After logout, a "Login" link appears in the header
    await expect(page.getByRole('link', { name: /Login/i })).toBeVisible();
  });
});
