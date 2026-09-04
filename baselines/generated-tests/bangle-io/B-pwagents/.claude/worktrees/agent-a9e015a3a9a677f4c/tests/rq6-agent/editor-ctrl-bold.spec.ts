// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Ctrl+B keyboard shortcut applies bold', () => {
  test('selects all text and applies bold with Ctrl+B shortcut', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-ctrl-bold');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('make this bold');
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Meta+b');

    await expect(page.locator('.ProseMirror strong')).toContainText('make this bold');
  });
});
