// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Unordered list from - markdown shorthand', () => {
  test('types - shorthand to render bullet list items', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-bullet-list');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('- First item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // The app renders bullet lists as prosemirror-flat-list elements with data-list-kind="bullet"
    const bulletItems = page.locator('.ProseMirror [data-list-kind="bullet"]');
    await expect(bulletItems).toHaveCount(2);

    // Verify the text content of each item
    await expect(bulletItems.nth(0)).toContainText('First item');
    await expect(bulletItems.nth(1)).toContainText('Second item');

    // Verify items are not rendered as plain paragraphs with dashes
    const listContent0 = bulletItems.nth(0).locator('.list-content p');
    const listContent1 = bulletItems.nth(1).locator('.list-content p');
    await expect(listContent0).toContainText('First item');
    await expect(listContent1).toContainText('Second item');
    await expect(listContent0).not.toContainText('- First item');
    await expect(listContent1).not.toContainText('- Second item');
  });
});
