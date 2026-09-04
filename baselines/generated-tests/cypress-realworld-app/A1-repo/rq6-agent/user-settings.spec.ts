import { test, expect } from "@playwright/test";
import { loginAsDefaultUser, BASE } from "./helpers";

test.describe("User Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.goto(`${BASE}/user/settings`);
    await page.waitForURL(/\/user\/settings/, { timeout: 5000 });
  });

  test("user settings page loads with current profile info", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-test="user-settings-form"]')
    ).toBeVisible({ timeout: 10000 });

    // Heath93's profile: Ted Parisian, email Santos.Runte65@gmail.com, phone 398-225-9900
    const firstNameInput = page.locator(
      '[data-test="user-settings-firstName-input"]'
    );
    const lastNameInput = page.locator(
      '[data-test="user-settings-lastName-input"]'
    );
    const emailInput = page.locator(
      '[data-test="user-settings-email-input"]'
    );
    const phoneInput = page.locator(
      '[data-test="user-settings-phoneNumber-input"]'
    );

    await expect(firstNameInput).toBeVisible();
    await expect(lastNameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(phoneInput).toBeVisible();

    // Fields should be pre-filled with user's current data
    await expect(firstNameInput).toHaveValue("Ted");
    await expect(lastNameInput).toHaveValue("Parisian");
    await expect(emailInput).toHaveValue("Santos.Runte65@gmail.com");
    await expect(phoneInput).toHaveValue("398-225-9900");
  });

  test("update profile fields and verify changes persist", async ({ page }) => {
    await expect(
      page.locator('[data-test="user-settings-form"]')
    ).toBeVisible({ timeout: 10000 });

    // Read current values
    const firstNameInput = page.locator(
      '[data-test="user-settings-firstName-input"]'
    );
    const lastNameInput = page.locator(
      '[data-test="user-settings-lastName-input"]'
    );

    // Update first name and last name
    const newFirstName = "TedUpdated";
    const newLastName = "ParisianUpdated";

    await firstNameInput.clear();
    await firstNameInput.fill(newFirstName);
    await lastNameInput.clear();
    await lastNameInput.fill(newLastName);

    // Save
    await page.locator('[data-test="user-settings-submit"]').click();
    await page.waitForTimeout(1000);

    // Reload to confirm persistence
    await page.reload();
    await page.waitForURL(/\/user\/settings/, { timeout: 5000 });
    await expect(
      page.locator('[data-test="user-settings-form"]')
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-test="user-settings-firstName-input"]')
    ).toHaveValue(newFirstName);
    await expect(
      page.locator('[data-test="user-settings-lastName-input"]')
    ).toHaveValue(newLastName);

    // Restore original values
    await page
      .locator('[data-test="user-settings-firstName-input"]')
      .clear();
    await page
      .locator('[data-test="user-settings-firstName-input"]')
      .fill("Ted");
    await page
      .locator('[data-test="user-settings-lastName-input"]')
      .clear();
    await page
      .locator('[data-test="user-settings-lastName-input"]')
      .fill("Parisian");
    await page.locator('[data-test="user-settings-submit"]').click();
    await page.waitForTimeout(500);
  });

  test("user settings is accessible via sidenav", async ({ page }) => {
    // Navigate away first, then use sidenav
    await page.goto(`${BASE}/`);
    await page.locator('[data-test="sidenav-user-settings"]').click();
    await page.waitForURL(/\/user\/settings/, { timeout: 5000 });
    await expect(
      page.locator('[data-test="user-settings-form"]')
    ).toBeVisible({ timeout: 10000 });
  });
});
