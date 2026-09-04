import { test, expect } from '@playwright/test';
import { signInUI, BASE_URL } from './helpers';

test.describe('User Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signInUI(page);
  });

  test('user settings page is accessible from sidebar', async ({ page }) => {
    await page.locator('[data-test="sidenav-user-settings"]').click();
    await page.waitForURL(/\/user\/settings/, { timeout: 10000 });
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible({ timeout: 10000 });
  });

  test('user settings form shows current user data', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/settings`);
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible({ timeout: 10000 });

    // The form should contain user data fields
    await expect(page.locator('[data-test="user-settings-firstName-input"]')).toBeVisible();
    await expect(page.locator('[data-test="user-settings-lastName-input"]')).toBeVisible();
    await expect(page.locator('[data-test="user-settings-email-input"]')).toBeVisible();
    await expect(page.locator('[data-test="user-settings-phoneNumber-input"]')).toBeVisible();

    // Fields should be pre-filled with the current user's data
    const firstNameValue = await page.locator('[data-test="user-settings-firstName-input"]').inputValue();
    expect(firstNameValue.length).toBeGreaterThan(0);
  });

  test('updating user profile first name persists the change', async ({ page }) => {
    await page.goto(`${BASE_URL}/user/settings`);
    await expect(page.locator('[data-test="user-settings-form"]')).toBeVisible({ timeout: 10000 });

    // Save the original value
    const firstNameInput = page.locator('[data-test="user-settings-firstName-input"]');
    const originalFirstName = await firstNameInput.inputValue();

    // Update the first name
    const newFirstName = `Updated${Date.now() % 10000}`;
    await firstNameInput.fill(newFirstName);

    // Submit the form
    await page.locator('[data-test="user-settings-submit"]').click();

    // Wait for success feedback (snackbar or page update)
    await page.waitForTimeout(2000);

    // Navigate away and come back to verify persistence
    await page.locator('[data-test="sidenav-home"]').click();
    await page.waitForURL(/\/$/, { timeout: 10000 });

    await page.locator('[data-test="sidenav-user-settings"]').click();
    await page.waitForURL(/\/user\/settings/, { timeout: 10000 });

    // The first name should be updated
    const updatedValue = await page.locator('[data-test="user-settings-firstName-input"]').inputValue();
    expect(updatedValue).toBe(newFirstName);

    // Restore the original value
    await firstNameInput.fill(originalFirstName);
    await page.locator('[data-test="user-settings-submit"]').click();
    await page.waitForTimeout(1000);
  });

  test('user balance is displayed in sidebar', async ({ page }) => {
    // The user balance should be shown in the sidebar
    await expect(page.locator('[data-test="sidenav-user-balance"]')).toBeVisible({ timeout: 10000 });
    const balanceText = await page.locator('[data-test="sidenav-user-balance"]').textContent();
    expect(balanceText).toBeTruthy();
  });

  test('user full name is displayed in sidebar', async ({ page }) => {
    await expect(page.locator('[data-test="sidenav-user-full-name"]')).toBeVisible({ timeout: 10000 });
    const fullName = await page.locator('[data-test="sidenav-user-full-name"]').textContent();
    expect(fullName?.length).toBeGreaterThan(0);
  });
});
