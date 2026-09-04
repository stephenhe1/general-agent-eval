// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Submitting a valid email on the signup page redirects to email verification', () => {
  test('redirects to OTP verification page after submitting valid email', async ({ page }) => {
    // Step: navigate to signup page
    await page.goto('/signup');
    await expect(page.getByText("Let's start your journey!")).toBeVisible();

    // Step: fill in a valid email address (unique per run to avoid caching issues)
    const uniqueEmail = `newuser_${Date.now()}@example.com`;
    await page.getByLabel(/email/i).fill(uniqueEmail);

    // Step: click the Submit button
    await page.getByRole('button', { name: 'Submit' }).click();

    // Step: verify redirect to email verification page
    await page.waitForURL(/\/verify/);
    await expect(page).toHaveURL(/\/verify\?type=onboarding/);

    // Step: verify the verification page shows the correct message
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText("We've sent you a code to verify your email address.")).toBeVisible();
  });
});
