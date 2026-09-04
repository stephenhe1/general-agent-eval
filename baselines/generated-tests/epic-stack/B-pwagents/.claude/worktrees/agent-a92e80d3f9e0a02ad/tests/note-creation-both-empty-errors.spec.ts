// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting the new note form with both title and content empty shows Required errors for both fields', () => {
  test('submitting the new note form with both title and content empty shows Required errors for both fields', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page).toHaveURL(/\/users\/kody\/notes\/new/);
    await expect(page.locator('#note-editor-title-error')).toBeVisible();
    await expect(page.locator('#note-editor-title-error')).toHaveText('Required');
    await expect(page.locator('#note-editor-content-error')).toBeVisible();
    await expect(page.locator('#note-editor-content-error')).toHaveText('Required');
  });
});
