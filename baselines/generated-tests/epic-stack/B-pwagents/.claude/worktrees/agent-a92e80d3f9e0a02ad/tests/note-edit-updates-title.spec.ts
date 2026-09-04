// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Editing a note\'s title and submitting updates the title shown on the note view page', () => {
  test("editing a note's title and submitting updates the title shown on the note view page", async ({ page }) => {
    // Create a new note first
    await page.goto('/users/kody/notes/new');
    await page.getByLabel(/title/i).fill('Original Title');
    await page.getByLabel(/content/i).fill('Original content');
    await page.getByRole('button', { name: /submit/i }).click();
    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    // Click Edit
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.waitForURL(/\/edit$/);

    // Update the title
    const titleInput = page.getByLabel(/title/i);
    await titleInput.clear();
    await titleInput.fill('Updated Title');
    await page.getByRole('button', { name: /submit/i }).click();

    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    await expect(page.getByRole('heading', { name: 'Updated Title' })).toBeVisible();
  });
});
