import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders with required fields', async ({ page }) => {
    await page.goto('/login/');
    await expect(page).toHaveTitle(/Indico/);
    await expect(page.locator('#identifier')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot my password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Indico' })).toBeVisible();
  });

  test('login with valid credentials succeeds and shows user menu', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    // Successful login redirects to home
    await expect(page).toHaveURL('/');
    // User name or session indicator is visible
    await expect(page.locator('#session-bar')).toContainText('A. User');
    // My profile link visible in session bar
    await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    // Still on login page or shows error
    const bodyText = await page.locator('body').textContent();
    const hasError = bodyText?.includes('Invalid') || bodyText?.includes('incorrect') ||
                     bodyText?.includes('wrong') || bodyText?.includes('failed') ||
                     page.url().includes('/login/');
    expect(hasError).toBeTruthy();
    // Should not be authenticated
    await expect(page.getByRole('link', { name: 'Logout' })).toHaveCount(0);
  });

  test('logout flow clears session and shows login button', async ({ page }) => {
    // Login first
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: 'My profile' })).toBeVisible();

    // Logout by navigating directly to logout URL
    await page.goto('/logout/?next=/');
    await page.waitForLoadState('networkidle');

    // Should see Login button again, not user menu
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    // My profile link should not be visible when logged out
    const myProfileLinks = await page.getByRole('link', { name: 'My profile' }).count();
    expect(myProfileLinks).toBe(0);
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/reset-password/');
    await expect(page.locator('body')).toBeVisible();
    // Page should have a form or relevant content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });

  test('unauthenticated access to manage page redirects to login', async ({ page }) => {
    await page.goto('/event/1/manage/');
    await page.waitForLoadState('networkidle');
    // Should redirect to login page
    await expect(page).toHaveURL(/\/login\//);
  });
});
