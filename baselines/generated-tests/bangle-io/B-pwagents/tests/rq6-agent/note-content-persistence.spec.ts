// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 31: Note Content Persistence After Reload', () => {
  test('note content persists after page reload', async ({ page }) => {
    // Set up workspace ws-persistence
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-persistence');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click New File to create untitled-1.md
    await page.getByTitle('New File').click();
    await expect(page.getByText('untitled-1.md')).toBeVisible();

    // Click in the editor, type content
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('# Persistence Test');
    await page.keyboard.press('Enter');
    await page.keyboard.type('This content should persist.');

    // Wait 1.5 seconds for auto-save
    await page.waitForTimeout(1500);

    // Reload the page
    await page.reload();

    // Wait for full load
    await page.waitForLoadState('domcontentloaded');

    // Navigate to the note URL
    await page.goto('http://127.0.0.1:5173/ws#route=editor&wsPath=ws-persistence%3Auntitled-1.md');
    await page.waitForLoadState('domcontentloaded');

    // Postconditions
    // Editor shows "Persistence Test" as h1 heading
    await expect(page.locator('h1').filter({ hasText: 'Persistence Test' })).toBeVisible();

    // Editor shows "This content should persist." as paragraph text
    await expect(page.getByText('This content should persist.')).toBeVisible();

    // Sidebar shows untitled-1.md
    await expect(page.getByText('untitled-1.md')).toBeVisible();
  });
});
