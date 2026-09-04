// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Edit link and Delete button appear on note view only when the owner is signed in', () => {
  test('edit link and Delete button appear on note view only when the owner is signed in', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e');

    const editLink = page.getByRole('link', { name: 'Edit', exact: true });
    await expect(editLink).toBeVisible();
    await expect(editLink).toHaveAttribute('href', '/users/kody/notes/d27a197e/edit');

    const deleteButton = page.getByRole('button', { name: /delete/i });
    await expect(deleteButton).toBeVisible();
  });
});
