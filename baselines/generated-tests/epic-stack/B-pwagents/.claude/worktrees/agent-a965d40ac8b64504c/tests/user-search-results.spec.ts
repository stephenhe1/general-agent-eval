// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Searching for kody in the users search page returns exactly one result', () => {
  test('search for kody returns exactly one user result', async ({ page }) => {
    // Step: navigate to users search page with kody as query
    await page.goto('/users?search=kody');

    // Step: verify the search results page is shown
    await expect(page.getByRole('heading', { name: /epic notes users/i })).toBeVisible();

    // Step: verify the search input has the query value
    await expect(page.locator('input[name="search"]').first()).toHaveValue('kody');

    // Step: verify exactly one result is shown with username "kody"
    const userLinks = page.getByRole('link', { name: /kody/i });
    await expect(userLinks.first()).toBeVisible();

    // Step: verify the result links to kody's profile
    await expect(page.getByRole('link', { name: /kody/i }).first()).toHaveAttribute('href', '/users/kody');
  });
});
