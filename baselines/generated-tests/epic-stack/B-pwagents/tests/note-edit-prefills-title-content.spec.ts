// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('The edit form for an existing note pre-fills the title and content fields with the current values', () => {
  test('the edit form for an existing note pre-fills the title and content fields with the current values', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e/edit');

    await expect(page.getByLabel(/title/i)).toHaveValue('Basic Koala Facts');
    await expect(page.getByLabel(/content/i)).toContainText(
      'Koalas are found in the eucalyptus forests of eastern Australia.',
    );
  });
});
