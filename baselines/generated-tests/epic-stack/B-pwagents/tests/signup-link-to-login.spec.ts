// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('The signup page has a working link back to the login page', () => {
  test('login link in header navigates to the login page', async ({ page }) => {
    // Step: navigate to signup page
    await page.goto('/signup');
    await expect(page.getByText("Let's start your journey!")).toBeVisible();

    // Step: verify the Log In link is visible in the header
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();

    // Step: click the Log In link
    await page.getByRole('link', { name: 'Log In' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Step: verify navigation to login page
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
  });
});
