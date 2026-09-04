// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';

test.describe('Navigating to a note URL with a nonexistent ID shows the notes list without a crash', () => {
  test('navigating to a note URL with a nonexistent ID shows the notes list without a crash', async ({ page }) => {
    await page.goto('/users/kody/notes/nonexistent123abc');

    await expect(page).toHaveURL('/users/kody/notes/nonexistent123abc');

    // The sidebar is still rendered with known note titles
    await expect(page.getByRole('link', { name: 'Basic Koala Facts' })).toBeVisible();

    // No crash/error page — page title or content is still recognizable
    await expect(page.getByRole('link', { name: 'Snowboarding Adventure' })).toBeVisible();
  });
});
