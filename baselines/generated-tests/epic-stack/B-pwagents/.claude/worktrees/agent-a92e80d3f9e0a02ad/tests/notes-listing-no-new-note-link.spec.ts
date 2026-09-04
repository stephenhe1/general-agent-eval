// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Unauthenticated user does not see New Note link on notes list page', () => {
  test('unauthenticated user does not see New Note link on notes list page', async ({ page }) => {
    await page.goto('/users/kody/notes');

    await expect(page.getByRole('link', { name: /new note/i })).not.toBeVisible();
  });
});
