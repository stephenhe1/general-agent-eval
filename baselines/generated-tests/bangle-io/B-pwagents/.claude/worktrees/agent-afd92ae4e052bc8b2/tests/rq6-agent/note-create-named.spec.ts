// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create Named Note from Workspace Home', () => {
  test('Create a note with a specific name from the workspace home New Note button', async ({ page }) => {
    // Step 1: Set up workspace ws-named-note using the setup helper
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-named-note');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click the New Note button on the workspace home page
    await page.getByRole('button', { name: 'New Note' }).click();

    // Step 3: A dialog appears with an input (placeholder "Input a note name")
    await expect(page.getByPlaceholder('Input a note name')).toBeVisible();

    // Step 4: Type my-custom-note in the input
    await page.getByPlaceholder('Input a note name').fill('my-custom-note');

    // Step 5: Press Enter
    await page.getByPlaceholder('Input a note name').press('Enter');

    // Step 6: Wait for navigation to the new note
    await page.waitForURL(/my-custom-note/);

    // Postcondition: URL contains my-custom-note.md
    expect(page.url()).toContain('my-custom-note.md');

    // Postcondition: Breadcrumb shows my-custom-note.md
    await expect(page.getByText('my-custom-note.md')).toBeVisible();

    // Postcondition: Sidebar Files section shows my-custom-note.md
    await expect(page.getByRole('link', { name: 'my-custom-note.md' })).toBeVisible();

    // Postcondition: Editor is visible
    await expect(page.locator('[contenteditable="true"]')).toBeVisible();
  });
});
