// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('After creating a note, its title appears in the notes list sidebar', () => {
  test('after creating a note, its title appears in the notes list sidebar', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await page.getByLabel(/title/i).fill('Sidebar Visibility Note');
    await page.getByLabel(/content/i).fill('Testing sidebar presence.');
    await page.getByRole('button', { name: /submit/i }).click();

    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    await page.goto('/users/kody/notes');

    await expect(page.getByRole('link', { name: 'Sidebar Visibility Note' }).first()).toBeVisible();
  });
});
