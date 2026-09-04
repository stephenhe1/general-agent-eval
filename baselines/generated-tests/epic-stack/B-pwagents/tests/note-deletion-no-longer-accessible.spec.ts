// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('After deleting a note, navigating directly to its URL shows no content for that note', () => {
  test('after deleting a note, navigating directly to its URL shows no content for that note', async ({ page }) => {
    // Create a note to delete
    await page.goto('/users/kody/notes/new');
    await page.getByLabel(/title/i).fill('Gone Note');
    await page.getByLabel(/content/i).fill('To be deleted.');
    await page.getByRole('button', { name: /submit/i }).click();
    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    // Record the note's URL
    const noteUrl = page.url();
    const noteId = noteUrl.split('/').pop()!;

    // Delete the note
    await page.getByRole('button', { name: /delete/i }).click();
    await page.waitForURL('/users/kody/notes');

    // Navigate back to the deleted note's URL
    await page.goto(`/users/kody/notes/${noteId}`);

    await expect(page.getByRole('heading', { name: 'Gone Note' })).not.toBeVisible();
  });
});
