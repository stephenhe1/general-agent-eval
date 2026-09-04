// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Submitting an invalid email on the signup page shows a validation error', () => {
  test('shows email validation error for invalid email address', async ({ page }) => {
    // Step: navigate to signup page
    await page.goto('/signup');

    // Step: fill in an invalid email address
    await page.getByLabel(/email/i).fill('not-an-email');

    // Step: click the Submit button
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForLoadState('domcontentloaded');

    // Step: still on signup page
    await expect(page).toHaveURL('/signup');

    // Step: verify validation error message is shown
    await expect(page.getByText('Email is invalid')).toBeVisible();
  });
});
