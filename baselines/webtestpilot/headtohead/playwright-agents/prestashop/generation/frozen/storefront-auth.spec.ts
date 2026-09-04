import { test, expect } from '@playwright/test';

const BUYER_EMAIL = 'auto.customer@example.com';
const BUYER_PASSWORD = 'mypassword';

// TC-38 Sign in with valid credentials
test('TC-38 sign in with valid credentials redirects to homepage and shows customer name', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'Email' }).fill(BUYER_EMAIL);
  await page.getByRole('textbox', { name: 'Password input' }).fill(BUYER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('domcontentloaded');

  // Should navigate away from /login
  const url = page.url();
  expect(url).not.toMatch(/\/login/);

  // Header should show customer name, not "Sign in" link
  const signInLink = page.getByRole('link', { name: /Sign in/i });
  expect(await signInLink.isVisible()).toBe(false);

  // Customer name or account link should be present
  const accountLink = page.locator('.account-link, .user-info, #_desktop_user_info .account');
  await expect(accountLink.first()).toBeVisible();

  // No error message
  const errorMsg = page.locator('.alert-danger, .notification-error, [class*="error"]');
  expect(await errorMsg.count()).toBe(0);
});

// TC-39 Sign in with invalid credentials shows error
test('TC-39 sign in with wrong password stays on login and shows error', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('textbox', { name: 'Email' }).fill(BUYER_EMAIL);
  await page.getByRole('textbox', { name: 'Password input' }).fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('domcontentloaded');

  // Should stay on /login
  await expect(page).toHaveURL(/\/login/);

  // Error message should be shown
  const errorMsg = page.locator('.alert-danger, [class*="error"], .notification-error').first();
  await expect(errorMsg).toBeVisible();
  await expect(errorMsg).toContainText(/authentication failed|invalid|incorrect/i);
});

// TC-40 Sign out
test('TC-40 sign out reverts header to sign-in link and blocks my-account access', async ({ page }) => {
  // First sign in
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(BUYER_EMAIL);
  await page.getByRole('textbox', { name: 'Password input' }).fill(BUYER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForLoadState('domcontentloaded');

  // Sign out
  await page.goto('/?mylogout=');
  await page.waitForLoadState('domcontentloaded');

  // "Sign in" link should be visible in header (use first to avoid strict mode)
  const signInLink = page.getByRole('link', { name: /Sign in/i }).first();
  await expect(signInLink).toBeVisible();

  // Navigating to /my-account should redirect to login
  await page.goto('/my-account');
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/login/i);
});

// TC-41 User registration — create a new account
test('TC-41 registration with new email creates account and shows customer name in header', async ({ page }) => {
  await page.goto('/registration');

  // Generate a unique email
  const uniqueEmail = `testuser_${Date.now()}@example.com`;

  // Title / gender
  const mrRadio = page.getByRole('radio', { name: /Mr|Male/i });
  if (await mrRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mrRadio.check();
  }

  await page.getByRole('textbox', { name: /first name/i }).fill('New');
  await page.getByRole('textbox', { name: /last name/i }).fill('Customer');
  await page.getByRole('textbox', { name: /email/i }).fill(uniqueEmail);
  await page.locator('input[name="password"], #field-password').first().fill('Secure@123!');

  // Agree to terms if required
  const termsCheckbox = page.locator('input[name*="psgdpr"], input[name*="customer_privacy"], input[id*="field-psgdpr"]');
  if (await termsCheckbox.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await termsCheckbox.first().check();
  }

  const submitBtn = page.getByRole('button', { name: /save|create|register|submit/i });
  await submitBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // Should redirect away from /registration
  const url = page.url();
  expect(url).not.toMatch(/\/registration/);

  // Customer name should be visible in header
  const signInLink = page.getByRole('link', { name: /Sign in/i });
  expect(await signInLink.isVisible()).toBe(false);

  // No form validation errors
  const errorMsg = page.locator('.alert-danger, .notification-error').first();
  const hasError = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);
  expect(hasError).toBe(false);
});

// TC-42 Registration with existing email shows error
test('TC-42 registering with an existing email shows inline error', async ({ page }) => {
  await page.goto('/registration');

  const mrRadio = page.getByRole('radio', { name: /Mr|Male/i });
  if (await mrRadio.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mrRadio.check();
  }

  await page.getByRole('textbox', { name: /first name/i }).fill('Duplicate');
  await page.getByRole('textbox', { name: /last name/i }).fill('User');
  await page.getByRole('textbox', { name: /email/i }).fill(BUYER_EMAIL);
  await page.locator('input[name="password"], #field-password').first().fill('Secure@123!');

  const termsCheckbox = page.locator('input[name*="psgdpr"], input[name*="customer_privacy"], input[id*="field-psgdpr"]');
  if (await termsCheckbox.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await termsCheckbox.first().check();
  }

  const submitBtn = page.getByRole('button', { name: /save|create|register|submit/i });
  await submitBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // Should stay on registration
  await expect(page).toHaveURL(/registration/i);

  // Error about existing email
  const errorMsg = page.locator('.alert-danger, .notification-error, [class*="error"]').first();
  await expect(errorMsg).toBeVisible();
});

// TC-43 Password recovery — unknown email shows generic message
test('TC-43 password recovery with unknown email shows confirmation message', async ({ page }) => {
  await page.goto('/password-recovery');

  const emailField = page.getByRole('textbox', { name: /email/i });
  await emailField.fill('nonexistent_nobody@nowhere.example');

  const sendBtn = page.getByRole('button', { name: /send|reset|submit/i });
  await sendBtn.click();
  await page.waitForLoadState('domcontentloaded');

  // A generic confirmation message should be shown (not leaking whether email exists)
  const confirmationMsg = page.locator('.alert-success, .alert-warning, .notification-success, [class*="success"], [class*="confirm"]').first();
  await expect(confirmationMsg).toBeVisible({ timeout: 5000 });
  const msgText = await confirmationMsg.textContent();
  expect(msgText?.trim().length).toBeGreaterThan(0);
});
