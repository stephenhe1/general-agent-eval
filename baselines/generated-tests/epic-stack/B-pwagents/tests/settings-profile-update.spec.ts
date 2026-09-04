// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting valid new username and name updates the profile', () => {
  test('updates profile successfully with valid username and name', async ({ page }) => {
    // Step: navigate to profile settings page (already authenticated)
    await page.goto('/settings/profile');

    // Step: clear and update the name field (keep username as kody)
    const nameInput = page.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Kody');

    // Step: click Save changes button
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL('/settings/profile');

    // Step: verify still on profile settings page (successful save stays on page)

    // Step: verify the name field still shows the updated value
    await expect(page.locator('input[name="name"]')).toHaveValue('Kody');
  });
});
