// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Unauthenticated user navigating to the new note form is redirected to login', () => {
  test('unauthenticated user navigating to the new note form is redirected to login', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/redirectTo=%2Fusers%2Fkody%2Fnotes%2Fnew/);
  });
});
