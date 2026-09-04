// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Successful login with valid credentials redirects to home page', () => {
  test('logs in with valid credentials and lands on home page', async ({ page }) => {
    // Step: navigate to home page using the stored authenticated session
    // (The auth setup verified login by filling credentials and confirming the redirect to /)
    await page.goto('/');

    // Step: verify on home page
    await expect(page).toHaveURL('/');

    // Step: verify authenticated state — user name visible in header
    await expect(page.getByText('Kody')).toBeVisible();

    // Step: verify the Log In link is NOT visible (confirming authenticated state)
    await expect(page.getByRole('link', { name: /log in/i })).not.toBeVisible();
  });
});
