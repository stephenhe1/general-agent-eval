// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Unauthenticated visitor does not see Edit or Delete controls on note view', () => {
  test('unauthenticated visitor does not see Edit or Delete controls on note view', async ({ page }) => {
    await page.goto('/users/kody/notes/d27a197e');

    await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).not.toBeVisible();
  });
});
