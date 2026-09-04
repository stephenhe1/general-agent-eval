// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('The profile photo page shows a file input and Save/Delete buttons', () => {
  test('photo settings page shows file input and delete button', async ({ page }) => {
    // Step: navigate to profile photo settings page (already authenticated)
    await page.goto('/settings/profile/photo');

    // Step: verify the page breadcrumb link confirms we are on the Photo page
    await expect(page.getByRole('link', { name: 'Photo' })).toBeVisible();

    // Step: verify the Change label (associated with file input) is present
    await expect(page.getByText('Change')).toBeVisible();

    // Step: verify the Delete button is visible (for removing the current photo)
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible();
  });
});
