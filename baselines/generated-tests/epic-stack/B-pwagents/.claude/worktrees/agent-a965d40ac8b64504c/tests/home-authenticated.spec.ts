// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe("The home page shows the logged-in user's name in the header after authentication", () => {
  test("shows the user's name in the header after login", async ({ page }) => {
    // Step: navigate to home page (already authenticated via storage state)
    await page.goto('/');

    // Step: verify the user's name "Kody" is visible in the header
    await expect(page.getByText('Kody')).toBeVisible();

    // Step: verify the Log In link is NOT shown (user is authenticated)
    await expect(page.getByRole('link', { name: 'Log In' })).not.toBeVisible();

    // Step: verify the app title is shown
    await expect(page).toHaveTitle('Epic Notes');
  });
});
