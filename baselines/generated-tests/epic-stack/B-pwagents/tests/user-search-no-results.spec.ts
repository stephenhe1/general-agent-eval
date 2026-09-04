// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Searching for a non-existent username shows a No users found message', () => {
  test('shows no users found message for non-existent username', async ({ page }) => {
    // Step: navigate to users search page with non-existent username
    await page.goto('/users?search=zzz_nonexistent_zzz');

    // Step: verify the search results page is shown
    await expect(page.getByRole('heading', { name: /epic notes users/i })).toBeVisible();

    // Step: verify the "No users found" message is displayed
    await expect(page.getByText('No users found')).toBeVisible();
  });
});
