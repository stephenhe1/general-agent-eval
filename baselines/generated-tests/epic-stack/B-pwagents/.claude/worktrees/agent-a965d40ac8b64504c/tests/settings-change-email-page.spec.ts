// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('The change-email page shows the current email address and an email input', () => {
  test('change email page shows current email address and new email input', async ({ page }) => {
    // Step: navigate to change email page (already authenticated)
    await page.goto('/settings/profile/change-email');

    // Step: verify the page heading
    await expect(page.getByRole('heading', { name: /change email/i })).toBeVisible();

    // Step: verify current email address is shown in the notice
    await expect(page.getByText('kody@kcd.dev')).toBeVisible();

    // Step: verify the New Email input is present
    await expect(page.getByLabel(/new email/i)).toBeVisible();

    // Step: verify the Send Confirmation button is present
    await expect(page.getByRole('button', { name: /send confirmation/i })).toBeVisible();
  });
});
