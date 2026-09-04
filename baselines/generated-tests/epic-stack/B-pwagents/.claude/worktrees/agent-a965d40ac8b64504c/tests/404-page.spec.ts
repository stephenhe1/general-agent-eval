// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Navigating to a non-existent route shows a custom not found page with a home link', () => {
  test('shows custom 404 page with path and home link for unknown route', async ({ page }) => {
    // Step: navigate to a non-existent route
    await page.goto('/this-does-not-exist-at-all');

    // Step: verify the custom not found page is shown
    await expect(page.getByText("We can't find this page:")).toBeVisible();

    // Step: verify the requested path is displayed
    await expect(page.getByText('/this-does-not-exist-at-all')).toBeVisible();

    // Step: verify the Back to home link is present
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();

    // Step: click Back to home and verify navigation
    await page.getByRole('link', { name: /back to home/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/');
  });
});
