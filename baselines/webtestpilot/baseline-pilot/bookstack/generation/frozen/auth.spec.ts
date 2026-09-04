import { test, expect } from '@playwright/test';
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

test.describe('Authentication', () => {
  test('login page renders form with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/BookStack/);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });

  test('login with valid credentials redirects to home', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
    // Confirm user is logged in — header has admin profile link
    const content = await page.content();
    expect(content).toContain('Admin');
  });

  test('login with wrong password shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Log In' }).click();
    // Should stay on login
    await expect(page).toHaveURL(/login/);
    const content = await page.content();
    expect(
      content.toLowerCase().includes('credentials') ||
      content.toLowerCase().includes('incorrect') ||
      content.toLowerCase().includes('invalid') ||
      content.toLowerCase().includes('these credentials')
    ).toBeTruthy();
  });

  test('login with missing password stays on login page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', ADMIN_EMAIL);
    // Don't fill password — browser validation should prevent submission
    await page.getByRole('button', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('logout via form submission ends session', async ({ page }) => {
    await login(page);
    // Submit the logout form using JavaScript since the button may be in a hidden menu
    await page.evaluate(() => {
      const form = document.querySelector('form[action*="logout"]') as HTMLFormElement;
      if (form) form.submit();
    });
    await page.waitForURL(/login/);
    await expect(page).toHaveURL(/login/);
    // After logout, visiting home should redirect back to login
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated access to home redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated access to shelves redirects to login', async ({ page }) => {
    await page.goto('/shelves');
    await expect(page).toHaveURL(/login/);
  });
});
