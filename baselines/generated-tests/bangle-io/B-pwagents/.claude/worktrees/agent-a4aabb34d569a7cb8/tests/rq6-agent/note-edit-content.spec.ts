// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 6: Edit Note Content in the Editor', () => {
  test('types content into editor and it persists after navigation', async ({ page }) => {
    // Set up workspace ws-edit-content
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-edit-content');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click the New File button in the sidebar
    await page.getByTitle('New File').click();

    // Wait for the editor to appear and untitled-1.md to be created
    await expect(page.getByText('untitled-1.md')).toBeVisible();

    // Click inside the editor (contenteditable)
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();

    // Type the heading and body
    await page.keyboard.type('# Hello World');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This is my first note.');

    // Wait 1 second for auto-save
    await page.waitForTimeout(1000);

    // Capture the current note URL
    const noteUrl = page.url();

    // Navigate to workspace home
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForURL(/ws-home/);

    // Navigate back to the note
    await page.goto(noteUrl);
    await page.waitForLoadState('domcontentloaded');

    // Postconditions: editor shows the correct content
    // Editor shows "Hello World" as an h1 heading
    await expect(page.locator('h1').filter({ hasText: 'Hello World' })).toBeVisible();

    // Editor shows "This is my first note." as body text
    await expect(page.getByText('This is my first note.')).toBeVisible();

    // Sidebar still shows untitled-1.md
    await expect(page.getByText('untitled-1.md')).toBeVisible();
  });
});
