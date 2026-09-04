// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Clicking Delete on a note view page removes the note and redirects to the notes list', () => {
  test('clicking Delete on a note view page removes the note and redirects to the notes list', async ({ page }) => {
    // Create a note to delete
    await page.goto('/users/kody/notes/new');
    await page.getByLabel(/title/i).fill('Delete Me Note');
    await page.getByLabel(/content/i).fill('This will be deleted.');
    await page.getByRole('button', { name: /submit/i }).click();
    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    // Delete the note
    await page.getByRole('button', { name: /delete/i }).click();

    await page.waitForURL('/users/kody/notes');

    await expect(page).toHaveURL('/users/kody/notes');
    await expect(page.getByRole('link', { name: 'Delete Me Note' })).not.toBeVisible();
  });
});
