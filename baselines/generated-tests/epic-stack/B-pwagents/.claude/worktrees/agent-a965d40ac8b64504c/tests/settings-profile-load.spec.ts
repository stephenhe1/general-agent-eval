// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe("The profile settings page shows the current user's username and name pre-filled", () => {
  test("profile settings page loads with kody's username and name pre-filled", async ({ page }) => {
    // Step: navigate to profile settings page (already authenticated)
    await page.goto('/settings/profile');

    // Step: verify the Edit Profile breadcrumb link is visible
    await expect(page.getByRole('link', { name: /edit profile/i })).toBeVisible();

    // Step: verify the username field is pre-filled with "kody"
    await expect(page.locator('input[name="username"]')).toHaveValue('kody');

    // Step: verify the name field is pre-filled with "Kody"
    await expect(page.locator('input[name="name"]')).toHaveValue('Kody');

    // Step: verify Save changes button is present
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
  });
});
