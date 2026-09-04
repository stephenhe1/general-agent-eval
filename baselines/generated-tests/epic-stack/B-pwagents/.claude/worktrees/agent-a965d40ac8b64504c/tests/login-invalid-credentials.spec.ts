// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Login with wrong password shows inline error message', () => {
  test('shows invalid username or password error after wrong password', async ({ page }) => {
    // Step: navigate to login page
    await page.goto('/login');

    // Step: fill in valid username
    await page.getByLabel(/username/i).fill('kody');

    // Step: fill in wrong password
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Step: click the Log in button
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('/login');

    // Step: still on login page

    // Step: verify inline error message is displayed
    await expect(page.getByText('Invalid username or password')).toBeVisible();
  });
});
