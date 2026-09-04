// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Submitting a valid email to forgot-password redirects to OTP verification page', () => {
  test('redirects to verify page after submitting known email on forgot-password', async ({ page }) => {
    // Step: navigate to forgot-password page
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Forgot Password' })).toBeVisible();

    // Step: fill in a registered email address
    await page.getByLabel(/username or email/i).fill('kody@kcd.dev');

    // Step: click the Recover password button
    await page.getByRole('button', { name: /recover password/i }).click();

    // Step: verify redirect to OTP verification page
    await page.waitForURL(/\/verify/);
    await expect(page).toHaveURL(/\/verify\?type=reset-password/);

    // Step: verify the verification page content
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText("We've sent you a code to verify your email address.")).toBeVisible();
  });
});
