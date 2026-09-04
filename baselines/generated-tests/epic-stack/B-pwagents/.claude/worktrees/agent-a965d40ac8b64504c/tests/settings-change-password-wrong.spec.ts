// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting the change-password form with an incorrect current password shows an error', () => {
  test('shows incorrect password error when current password is wrong', async ({ page }) => {
    // Step: navigate to change password page (already authenticated)
    await page.goto('/settings/profile/password');

    // Step: fill in wrong current password
    await page.getByLabel('Current Password').fill('wrongpassword');

    // Step: fill in a valid new password
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');

    // Step: confirm the new password
    await page.getByLabel('Confirm New Password').fill('newpassword123');

    // Step: click the Change Password button
    await page.getByRole('button', { name: /change password/i }).click();
    await page.waitForURL('/settings/profile/password');

    // Step: still on change password page

    // Step: verify the incorrect password error message
    await expect(page.getByText('Incorrect password.')).toBeVisible();
  });
});
