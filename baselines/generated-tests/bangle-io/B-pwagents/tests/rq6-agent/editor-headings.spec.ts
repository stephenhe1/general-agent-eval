// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Heading formatting via markdown shorthand', () => {
  test('types # ## ### shorthand to render h1 h2 h3 headings', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-headings');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('# Heading One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Heading Two');
    await page.keyboard.press('Enter');
    await page.keyboard.type('### Heading Three');
    await page.keyboard.press('Enter');

    await expect(page.locator('.ProseMirror h1')).toContainText('Heading One');
    await expect(page.locator('.ProseMirror h2')).toContainText('Heading Two');
    await expect(page.locator('.ProseMirror h3')).toContainText('Heading Three');
  });
});
