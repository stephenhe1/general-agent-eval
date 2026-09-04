// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe("Submitting change-password when new and confirm passwords don't match shows an error", () => {
  test('shows passwords must match error when new passwords differ', async ({ page }) => {
    // Step: navigate to change password page (already authenticated)
    await page.goto('/settings/profile/password');

    // Step: fill in correct current password
    await page.getByLabel('Current Password').fill('kodylovesyou');

    // Step: fill in a new password
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');

    // Step: fill in a different confirm password
    await page.getByLabel('Confirm New Password').fill('differentpassword456');

    // Step: click the Change Password button
    await page.getByRole('button', { name: /change password/i }).click();
    await page.waitForURL('/settings/profile/password');

    // Step: still on change password page

    // Step: verify the passwords must match error message
    await expect(page.getByText('The passwords must match')).toBeVisible();
  });
});
