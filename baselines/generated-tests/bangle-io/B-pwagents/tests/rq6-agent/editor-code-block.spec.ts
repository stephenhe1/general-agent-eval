// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Code block from triple-backtick shorthand', () => {
  test('types triple backtick shorthand to render a code block', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-code-block');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    // Typing three backticks immediately converts the paragraph into a <pre><code> block
    await page.keyboard.type('```');
    // Enter moves the cursor to a new paragraph after the code block;
    // ArrowUp navigates back into the code block to type content inside it
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.type('const x = 42;');

    const pre = page.locator('.ProseMirror pre');
    await expect(pre).toBeVisible();

    const code = page.locator('.ProseMirror pre code');
    await expect(code).toContainText('const x = 42;');
  });
});
