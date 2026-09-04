// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Clicking the Edit link on a note view page navigates to the edit form URL', () => {
  test('clicking the Edit link on a note view page navigates to the edit form URL', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e');

    await page.getByRole('link', { name: 'Edit', exact: true }).click();

    await expect(page).toHaveURL('/users/kody/notes/d27a197e/edit');
    await expect(page.getByLabel(/title/i)).toHaveValue('Basic Koala Facts');
  });
});
