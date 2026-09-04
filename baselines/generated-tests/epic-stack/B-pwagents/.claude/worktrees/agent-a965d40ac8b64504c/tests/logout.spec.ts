// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_LOGOUT_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_LOGOUT_AUTH_FILE });

test.describe('Clicking Logout clears the session and redirects to home', () => {
  test('logs out and redirects to home showing Log In link', async ({ page }) => {
    // Step: navigate to user profile page which has the Logout button (already authenticated)
    await page.goto('/users/kody');
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();

    // Step: click the Logout button
    await page.getByRole('button', { name: /logout/i }).click();
    await page.waitForLoadState('domcontentloaded');

    // Step: verify redirect to home page
    await expect(page).toHaveURL('/');

    // Step: verify user is logged out — Log In link is visible in header
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
  });
});
