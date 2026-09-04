// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Undo/Redo with Ctrl+Z / Ctrl+Shift+Z', () => {
  test('Meta+Z undoes typed text and Meta+Shift+Z redoes it', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-undo-redo');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    await page.locator('.ProseMirror[contenteditable="true"]').click();
    await page.keyboard.type('Hello World');

    // Verify text was typed
    await expect(page.locator('.ProseMirror')).toContainText('Hello World');

    // Undo — text should disappear
    await page.keyboard.press('Meta+Z');
    await expect(page.locator('.ProseMirror')).not.toContainText('Hello World');

    // Redo — text should reappear
    await page.keyboard.press('Meta+Shift+Z');
    await expect(page.locator('.ProseMirror')).toContainText('Hello World');
  });
});
