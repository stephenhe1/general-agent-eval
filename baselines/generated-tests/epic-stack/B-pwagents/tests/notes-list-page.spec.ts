// spec: specs/auth-navigation-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe("The notes list for kody shows known seeded notes by title", () => {
  test("kody's notes list shows seeded note titles", async ({ page }) => {
    // Step: navigate to kody's notes list (already authenticated)
    await page.goto('/users/kody/notes');

    // Step: verify the page heading
    await expect(page.getByRole('heading', { name: "Kody's Notes" })).toBeVisible();

    // Step: verify known seeded note titles are present
    await expect(page.getByText('Basic Koala Facts')).toBeVisible();
    await expect(page.getByText('Snowboarding Adventure')).toBeVisible();
    await expect(page.getByText('Koala Fun Facts')).toBeVisible();

    // Step: verify New Note button is present (user is viewing own notes)
    await expect(page.getByRole('link', { name: /new note/i })).toBeVisible();
  });
});
