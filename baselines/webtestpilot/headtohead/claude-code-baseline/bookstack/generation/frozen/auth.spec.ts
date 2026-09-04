import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders with expected form elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/BookStack/);
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    // Remember me uses a toggle-switch pattern (label visible, checkbox may be hidden)
    await expect(page.locator('label:has-text("Remember Me"), label:has-text("Keep me logged in"), label:has([name="remember"])').or(
      page.locator('.toggle-switch').filter({ hasText: /remember/i })
    ).or(
      page.locator('label').filter({ hasText: /remember/i })
    )).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible();
  });

  test('login with valid credentials redirects to home', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@admin.com');
    await page.fill('[name="password"]', 'password');
    await page.click('#login-form button');
    await page.waitForLoadState('networkidle');
    // Should be on home or dashboard
    await expect(page).toHaveURL(/localhost:8081\/?$/);
    await expect(page).toHaveTitle(/BookStack/);
    // Should see the authenticated navigation links (use data-shortcut attributes from BookStack's nav)
    await expect(page.locator('[data-shortcut="books_view"]')).toBeVisible();
    await expect(page.locator('[data-shortcut="shelves_view"]')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('#login-form button');
    await page.waitForLoadState('networkidle');
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
    // Error message should be present
    const errorMsg = page.locator('.error-list, .notification, [class*="error"], [class*="danger"]');
    await expect(errorMsg.first()).toBeVisible();
  });

  test('forgot password page renders form', async ({ page }) => {
    await page.goto('/password/email');
    await expect(page).toHaveTitle(/BookStack/);
    await expect(page.locator('[name="email"]')).toBeVisible();
  });

  test('logout redirects to login page', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@admin.com');
    await page.fill('[name="password"]', 'password');
    await page.click('#login-form button');
    await page.waitForLoadState('networkidle');

    // Open user dropdown to access logout
    const dropdownToggle = page.locator('[component="dropdown"]').first().locator('[refs*="dropdown@toggle"]');
    await dropdownToggle.click();

    // Find and click logout button
    const logoutBtn = page.locator('button:has-text("Logout"), form[action*="/logout"] button');
    await expect(logoutBtn.first()).toBeVisible();
    await logoutBtn.first().click();
    await page.waitForLoadState('networkidle');

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
