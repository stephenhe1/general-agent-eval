// spec: specs/notes-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from './fixtures';
import { KODY_AUTH_FILE } from './auth-state';

test.use({ storageState: KODY_AUTH_FILE });

test.describe('Submitting the new note form with valid title and content creates the note and redirects to its view page', () => {
  test('submitting the new note form with valid title and content creates the note and redirects to its view page', async ({ page }) => {
    await page.goto('/users/kody/notes/new');

    await page.getByLabel(/title/i).fill('My New Test Note');
    await page.getByLabel(/content/i).fill('This is the body of my new test note.');
    await page.getByRole('button', { name: /submit/i }).click();

    await page.waitForURL(/\/users\/kody\/notes\/(?!new)[^/]+$/);

    await expect(page.getByRole('heading', { name: 'My New Test Note' })).toBeVisible();
    await expect(page.getByText('This is the body of my new test note.')).toBeVisible();
  });
});
