// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('The home page shows the app name and a Log In link when not authenticated', () => {
  test('shows epic notes branding and Log In link for unauthenticated visitors', async ({ page }) => {
    // Step: navigate to home page without being logged in
    await page.goto('/');

    // Step: verify page title
    await expect(page).toHaveTitle('Epic Notes');

    // Step: verify the app name "epic notes" is visible
    await expect(page.getByRole('link', { name: /epic.*notes/i }).first()).toBeVisible();

    // Step: verify the Log In link is present in the header
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();

    // Step: verify the main content is shown
    await expect(page.getByText('The Epic Stack')).toBeVisible();
  });
});
