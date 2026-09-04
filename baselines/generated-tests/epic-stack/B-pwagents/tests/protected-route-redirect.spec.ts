// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Accessing a protected page while logged out redirects to login with return URL', () => {
  test('redirects to login with redirectTo param when accessing protected route unauthenticated', async ({ page }) => {
    // Step: attempt to navigate to a protected page without being logged in
    await page.goto('/settings/profile');

    // Step: verify redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Step: verify the redirectTo query parameter contains the protected route
    await expect(page).toHaveURL(/redirectTo=%2Fsettings%2Fprofile/);

    // Step: verify the login page is shown with its welcome heading
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  });
});
