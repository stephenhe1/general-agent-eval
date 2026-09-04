// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe("Visiting /users/kody shows the profile with correct username, join date, and action links", () => {
  test('kody profile shows name, join date, and action links', async ({ page }) => {
    // Step: navigate to kody's profile (already authenticated)
    await page.goto('/users/kody');

    // Step: verify the page title includes Kody
    await expect(page).toHaveTitle(/Kody/);

    // Step: verify the username heading is shown
    await expect(page.getByRole('heading', { name: 'Kody' })).toBeVisible();

    // Step: verify the join date is displayed
    await expect(page.getByText(/Joined/)).toBeVisible();
    await expect(page.getByText(/8\/23\/2026/)).toBeVisible();

    // Step: verify the Logout button is present
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

    // Step: verify the My notes link is present
    await expect(page.getByRole('link', { name: /my notes/i })).toBeVisible();

    // Step: verify the Edit profile link is present
    await expect(page.getByRole('link', { name: /edit profile/i })).toBeVisible();
  });
});
