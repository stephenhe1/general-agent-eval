// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Blockquote from > markdown shorthand', () => {
  test('types > shorthand to render a blockquote element', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-blockquote');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('> This is a quote');
    await page.keyboard.press('Enter');

    const blockquote = page.locator('.ProseMirror blockquote');
    await expect(blockquote).toBeVisible();
    await expect(blockquote).toContainText('This is a quote');
  });
});
