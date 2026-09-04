// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Horizontal rule from --- shorthand', () => {
  test('typing "---" and pressing Enter inserts an hr element', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-horiz-rule');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    await page.locator('.ProseMirror[contenteditable="true"]').click();
    await page.keyboard.type('Some text above');
    await page.keyboard.press('Enter');
    await page.keyboard.type('---');
    await page.keyboard.press('Enter');

    // Assert an <hr> element exists in the editor
    await expect(page.locator('.ProseMirror hr')).toHaveCount(1);

    // The text above the hr should still be present
    await expect(page.locator('.ProseMirror')).toContainText('Some text above');
  });
});
