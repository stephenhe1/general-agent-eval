// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Typing kody in the global search navigates to the users search results', () => {
  test('global search navigates to /users search results page', async ({ page }) => {
    // Step: navigate to home page
    await page.goto('/');

    // Step: find the search input in the navigation bar
    await page.locator('input[name="search"]').first().fill('kody');

    // Step: press Enter to submit the search
    await page.locator('input[name="search"]').first().press('Enter');
    await page.waitForLoadState('domcontentloaded');

    // Step: verify navigation to users search results page
    await expect(page).toHaveURL(/\/users\?search=kody/);

    // Step: verify the search results page heading
    await expect(page.getByRole('heading', { name: /epic notes users/i })).toBeVisible();

    // Step: verify kody appears in search results (the username shown below the display name)
    await expect(page.getByRole('link', { name: /kody profile/i })).toBeVisible();
  });
});
