// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting the new note form with empty content shows a Required error for the content field', () => {
  test('submitting the new note form with empty content shows a Required error for the content field', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await page.getByLabel(/title/i).fill('A Title');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page).toHaveURL(/\/users\/kody\/notes\/new/);
    await expect(page.locator('#note-editor-content-error')).toBeVisible();
    await expect(page.locator('#note-editor-content-error')).toHaveText('Required');
  });
});
