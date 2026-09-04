// spec: specs/core-features.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('1.2 Login with invalid credentials', async ({ page }) => {
    // No seed setup - test must run unauthenticated
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.getByRole('button', { name: 'Log In' }).click();

    await expect(page).toHaveURL('/login');
    await expect(page.locator('.text-neg.text-small')).toHaveText(
      'These credentials do not match our records.'
    );
    await expect(page.locator('#email')).toHaveClass(/text-neg/);
  });
});
