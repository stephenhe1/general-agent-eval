import { test, expect } from '@playwright/test';
import * as path from 'path';
import { uniqueName, gotoWithRetry } from './helpers';

const AUTH_STATE = path.join(__dirname, 'playwright-auth.json');

test.describe('Settings (requires auth)', () => {
  // Apply storageState only within this describe block
  test.use({ storageState: AUTH_STATE });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('settings/profile page shows profile edit form with username field', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile');
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save|update|submit/i })).toBeVisible();
  });

  test('settings/profile page pre-fills the current username as kody', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile');
    const usernameField = page.getByLabel(/username/i);
    const currentValue = await usernameField.inputValue();
    expect(currentValue).toBe('kody');
  });

  test('settings/profile: update display name persists after save', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile');

    // Find the Name field (label text "Name")
    const nameLabel = page.locator('label', { hasText: /^Name$/i });
    if (await nameLabel.count() === 0) {
      test.skip(true, 'No Name field found on profile page');
      return;
    }
    // Get the input linked to this label
    const nameFor = await nameLabel.getAttribute('for');
    const nameField = nameFor
      ? page.locator(`#${nameFor}`)
      : page.getByLabel(/^name$/i);

    const originalName = await nameField.inputValue();
    const newName = uniqueName('TestUser');

    await nameField.fill(newName);
    await page.getByRole('button', { name: /save|update|submit/i }).click();
    await page.waitForTimeout(2000);

    // Reload and verify the name persisted
    await page.reload();
    const nameFieldAfter = nameFor
      ? page.locator(`#${nameFor}`)
      : page.getByLabel(/^name$/i);
    const savedValue = await nameFieldAfter.inputValue();
    expect(savedValue).toBe(newName);

    // Restore original name
    await nameFieldAfter.fill(originalName);
    await page.getByRole('button', { name: /save|update|submit/i }).click();
    await page.waitForTimeout(1000);
  });

  test('settings/profile/password page shows change password form', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/password');
    await expect(page.getByLabel('Current Password')).toBeVisible();
    // Use exact: true to avoid matching "Confirm New Password"
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm New Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /change|update|save/i })).toBeVisible();
  });

  test('settings/profile/password: wrong current password shows error', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/password');
    await page.getByLabel('Current Password').fill('WrongCurrentPassword123!');
    await page.getByLabel('New Password', { exact: true }).fill('NewValidPassword123!');
    await page.getByLabel('Confirm New Password').fill('NewValidPassword123!');
    await page.getByRole('button', { name: /change|update|save/i }).click();
    await page.waitForTimeout(2000);
    // Should remain on the password page
    expect(page.url()).toContain('/password');
    // Should show an error
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const hasError = bodyText.includes('incorrect') || bodyText.includes('wrong') || bodyText.includes('invalid') || bodyText.includes('error') || bodyText.includes('match');
    expect(hasError).toBe(true);
  });

  test('settings/profile/photo page loads without error', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/photo');
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const hasPhotoContent = bodyText.includes('photo') || bodyText.includes('avatar') || bodyText.includes('image') || bodyText.includes('picture');
    expect(hasPhotoContent).toBe(true);
  });

  test('settings/profile/change-email page shows email change form', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/change-email');
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('settings/profile/connections page loads without error', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/connections');
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!;
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('settings/profile/two-factor page loads and shows 2FA options', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/two-factor');
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const has2FAContent = bodyText.includes('two') || bodyText.includes('factor') || bodyText.includes('2fa') || bodyText.includes('authenticat');
    expect(has2FAContent).toBe(true);
  });

  test('settings/profile/passkeys page loads without error', async ({ page }) => {
    await gotoWithRetry(page, '/settings/profile/passkeys');
    await expect(page.getByText(/Application Error|Unexpected Application Error/i)).not.toBeVisible();
    const bodyText = (await page.locator('body').textContent())!.toLowerCase();
    const hasPasskeyContent = bodyText.includes('passkey') || bodyText.includes('webauthn') || bodyText.includes('key');
    expect(hasPasskeyContent).toBe(true);
  });
});

test.describe('Settings - unauthenticated redirect', () => {
  // Intentionally NO storageState - this tests unauthenticated behavior
  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(1500);
  });

  test('unauthenticated access to settings redirects to login', async ({ page }) => {
    // Use plain goto - this test EXPECTS a redirect to /login
    await page.goto('/settings/profile');
    // The server should redirect unauthenticated users to login
    await page.waitForURL(
      url => url.pathname.includes('/login') || !url.pathname.startsWith('/settings'),
      { timeout: 10000 }
    );
    expect(page.url()).not.toContain('/settings/profile');
  });
});
