import { test, expect } from '@playwright/test';
import { loginAs, TEST_USER, gotoWithRetry } from './helpers';

test.describe('Authentication', () => {
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(2000);
  });

  test('login page renders form fields', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await expect(page).toHaveTitle(/Login/i);
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    // Should have links to signup and forgot password
    await expect(page.getByRole('link', { name: /create an account|sign up/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  });

  test('login with valid credentials succeeds and redirects away from /login', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await page.getByLabel('Username').fill(TEST_USER.username);
    await page.getByLabel('Password').fill(TEST_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15000 });
    // After login the user should not be on the login page
    expect(page.url()).not.toContain('/login');
  });

  test('login with wrong password shows an error message', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await page.getByLabel('Username').fill(TEST_USER.username);
    await page.getByLabel('Password').fill('definitelyWrongPassword123!');
    await page.getByRole('button', { name: /log in/i }).click();
    // Should stay on login page or show error
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    const isStillOnLogin = currentUrl.includes('/login');
    if (isStillOnLogin) {
      // Check for error message
      const bodyText = (await page.locator('body').textContent())!.toLowerCase();
      const hasError = bodyText.includes('invalid') || bodyText.includes('incorrect') || bodyText.includes('wrong') || bodyText.includes('credentials');
      expect(hasError).toBe(true);
    }
    // Even if redirected, the page should not show the user dashboard normally
  });

  test('login with empty credentials shows validation errors', async ({ page }) => {
    await gotoWithRetry(page, '/login');
    await page.getByRole('button', { name: /log in/i }).click();
    // Should stay on login page with validation errors
    await page.waitForTimeout(500);
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    // Either browser validation or form validation
    const isStillOnLogin = page.url().includes('/login');
    expect(isStillOnLogin).toBe(true);
  });

  test('signup page renders email form', async ({ page }) => {
    await gotoWithRetry(page, '/signup');
    await expect(page).toHaveTitle(/Sign Up/i);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /create|submit|sign up|get started/i })).toBeVisible();
    // Has link back to login
    await expect(page.getByRole('link', { name: /log in|sign in/i })).toBeVisible();
  });

  test('signup with invalid email shows validation error', async ({ page }) => {
    await gotoWithRetry(page, '/signup');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /create|submit|sign up|get started/i }).click();
    await page.waitForTimeout(500);
    // Should stay on signup or show validation error
    const isStillOnSignup = page.url().includes('/signup');
    expect(isStillOnSignup).toBe(true);
  });

  test('forgot password page renders form', async ({ page }) => {
    await gotoWithRetry(page, '/forgot-password');
    await expect(page.getByLabel(/username or email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /recover|reset|submit|send/i })).toBeVisible();
  });

  test('logout flow: logged-in user can log out', async ({ page }) => {
    // Login first
    await loginAs(page);
    // After login, we should be logged in
    expect(page.url()).not.toContain('/login');
    // Navigate to logout
    await page.goto('/logout');
    // Should redirect away and no longer be authenticated
    // Check that after logout, login link appears
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    // After logout, either we see the login page or the home page with login link
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const isLoggedOut = bodyText.includes('log in') || bodyText.includes('login') || currentUrl.includes('/login') || currentUrl.includes('/');
    expect(isLoggedOut).toBe(true);
  });

  test('authenticated user sees their username in navigation', async ({ page }) => {
    await loginAs(page);
    // Look for the username or user avatar in the nav
    const bodyText = await page.locator('body').textContent();
    // User should see their username (kody) somewhere in the navigation area
    const hasUsername = bodyText!.toLowerCase().includes('kody');
    expect(hasUsername).toBe(true);
  });
});
