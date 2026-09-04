// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Clicking Reset on the new note form clears all entered values', () => {
  test('clicking Reset on the new note form clears all entered values', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await page.getByLabel(/title/i).fill('Draft Title');
    await page.getByLabel(/content/i).fill('Draft content');

    await page.getByRole('button', { name: /reset/i }).click();

    await expect(page.getByLabel(/title/i)).toHaveValue('');
    await expect(page.getByLabel(/content/i)).toHaveValue('');
  });
});
