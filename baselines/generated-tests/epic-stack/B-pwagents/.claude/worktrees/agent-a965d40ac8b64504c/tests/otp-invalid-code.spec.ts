// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Submitting an incorrect OTP code on the verification page shows an invalid code error', () => {
  test('shows invalid code error after submitting wrong OTP', async ({ page }) => {
    // Step: use the forgot-password flow to get to the verify page with a fresh session
    await page.goto('/forgot-password');
    await page.getByLabel(/username or email/i).fill('kody@kcd.dev');
    await page.getByRole('button', { name: /recover password/i }).click();

    // Step: wait for redirect to verify page
    await page.waitForURL(/\/verify/);
    await expect(page.getByText('Check your email')).toBeVisible();

    // Step: fill in an invalid OTP code
    await page.locator('input[name="code"]').fill('000000');

    // Step: click the Submit button
    await page.getByRole('button', { name: /submit/i }).click();
    await page.waitForURL(/\/verify/);

    // Step: still on verify page

    // Step: verify the invalid code error message is displayed
    await expect(page.getByText('Invalid code')).toBeVisible();
  });
});
