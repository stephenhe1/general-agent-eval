// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bold and italic via inline markdown shorthand', () => {
  test('types **text** and *text* to render strong and em elements', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-bold-italic');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('**bold text**');
    await page.keyboard.press('Enter');
    await page.keyboard.type('*italic text*');
    await page.keyboard.press('Enter');

    await expect(page.locator('.ProseMirror strong')).toContainText('bold text');
    await expect(page.locator('.ProseMirror em')).toContainText('italic text');
  });
});
