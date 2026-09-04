// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Ctrl+I keyboard shortcut applies italic', () => {
  test('Meta+I wraps selected text in em element', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-ctrl-italic');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    // Type text then select all and apply italic
    await page.locator('.ProseMirror[contenteditable="true"]').click();
    await page.keyboard.type('make this italic');
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Meta+I');

    // Assert the editor wraps the text in an <em> element
    await expect(page.locator('.ProseMirror em')).toHaveCount(1);
    await expect(page.locator('.ProseMirror em')).toHaveText('make this italic');
  });
});
