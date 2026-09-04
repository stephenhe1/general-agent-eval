// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('The change-password page shows three password fields', () => {
  test('change password page shows current, new, and confirm password fields', async ({ page }) => {
    // Step: navigate to change password page (already authenticated)
    await page.goto('/settings/profile/password');

    // Step: verify the page breadcrumb link confirms we are on the Password page
    await expect(page.getByRole('link', { name: /password/i })).toBeVisible();

    // Step: verify the Current Password field is present
    await expect(page.getByLabel('Current Password')).toBeVisible();

    // Step: verify the New Password field is present
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();

    // Step: verify the Confirm New Password field is present
    await expect(page.getByLabel('Confirm New Password')).toBeVisible();

    // Step: verify the Change Password submit button is present
    await expect(page.getByRole('button', { name: /change password/i })).toBeVisible();
  });
});
