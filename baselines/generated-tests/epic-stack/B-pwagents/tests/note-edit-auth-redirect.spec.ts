// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Unauthenticated user navigating to a note edit URL is redirected to login', () => {
  test('unauthenticated user navigating to a note edit URL is redirected to login', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e/edit');

    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/redirectTo=%2Fusers%2Fkody%2Fnotes%2Fd27a197e%2Fedit/);
  });
});
