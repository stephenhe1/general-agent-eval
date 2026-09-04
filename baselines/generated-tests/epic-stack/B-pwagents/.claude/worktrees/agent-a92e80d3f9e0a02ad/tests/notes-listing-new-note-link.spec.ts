// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Authenticated user sees New Note link on notes list page', () => {
  test('authenticated user sees New Note link on notes list page', async ({ page }) => {
    await page.goto('/users/kody/notes');

    const newNoteLink = page.getByRole('link', { name: /new note/i });
    await expect(newNoteLink).toBeVisible();
    await expect(newNoteLink).toHaveAttribute('href', '/users/kody/notes/new');
  });
});
