// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting an invalid new email on change-email page shows a validation error', () => {
  test('shows validation error for invalid email on change-email page', async ({ page }) => {
    // Step: navigate to change email page (already authenticated)
    await page.goto('/settings/profile/change-email');

    // Step: fill in an invalid email address
    await page.getByLabel(/new email/i).fill('not-an-email');

    // Step: click the Send Confirmation button
    await page.getByRole('button', { name: /send confirmation/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Step: still on change email page
    await expect(page).toHaveURL('/settings/profile/change-email');

    // Step: verify the exact validation error message
    await expect(page.getByText('Email is invalid')).toBeVisible();
  });
});
