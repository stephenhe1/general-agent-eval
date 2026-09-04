// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 14: Clone Note', () => {
  test('clone note creates a copy with the same content', async ({ page }) => {
    // Step 1: Set up workspace ws-clone-note
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // Browser radio is pre-selected by default
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-clone-note');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(800);

    // Step 3: Click in the editor and type 'Original content here'
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type('Original content here');
    await page.waitForTimeout(400);

    // Step 4: Open command palette, type 'Clone Note', click the Clone Note command
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(400);

    const cmdInput = page.locator('input[placeholder*="Type a command" i], input[placeholder*="command or search" i]').first();
    await cmdInput.fill('Clone Note');
    await page.waitForTimeout(400);

    await page.getByRole('option', { name: /Clone Note/ }).click();

    // Step 5: Wait for navigation
    await page.waitForURL(/untitled-1-copy-1\.md/);

    // Postcondition: URL contains 'untitled-1-copy-1.md' (or similar clone name)
    expect(page.url()).toContain('untitled-1-copy-1.md');

    // Postcondition: Editor shows "Original content here"
    await expect(editor).toContainText('Original content here');

    // Postcondition: Sidebar shows both untitled-1.md and the cloned note
    const clonedBtn = page.getByRole('button', { name: /untitled-1-copy-1\.md/ });
    await expect(clonedBtn.first()).toBeVisible();

    // The original file appears in sidebar (e.g., in Opened/Recent section)
    const originalFileLink = page.locator('a, button').filter({ hasText: 'untitled-1.md' });
    await expect(originalFileLink.first()).toBeVisible();
  });
});
