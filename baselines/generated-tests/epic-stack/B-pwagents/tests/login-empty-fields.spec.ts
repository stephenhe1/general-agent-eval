// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Submitting login form with empty username and password shows required field errors', () => {
  test('shows required field errors when username and password are empty', async ({ page }) => {
    // Step: navigate to login page
    await page.goto('/login');

    // Step: click the Log in button without filling fields
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Step: still on login page
    await expect(page).toHaveURL('/login');

    // Step: verify username required error is displayed
    await expect(page.getByText('Username is required')).toBeVisible();

    // Step: verify password required error is displayed
    await expect(page.getByText('Password is required')).toBeVisible();
  });
});
