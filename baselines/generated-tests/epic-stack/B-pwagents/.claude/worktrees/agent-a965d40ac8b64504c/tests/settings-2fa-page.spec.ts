// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('The 2FA settings page shows not enabled state with an Enable 2FA button', () => {
  test('2FA page shows disabled state with Enable 2FA button', async ({ page }) => {
    // Step: navigate to 2FA settings page (already authenticated)
    await page.goto('/settings/profile/two-factor');

    // Step: verify the page breadcrumb link confirms we are on the 2FA page
    await expect(page.getByRole('link', { name: '2FA' })).toBeVisible();

    // Step: verify the not-enabled message
    await expect(page.getByText('You have not enabled two-factor authentication yet.')).toBeVisible();

    // Step: verify the explanation text about authenticator apps
    await expect(page.getByText(/authenticator app/i)).toBeVisible();

    // Step: verify the Enable 2FA submit button is present
    await expect(page.getByRole('button', { name: 'Enable 2FA' })).toBeVisible();
  });
});
