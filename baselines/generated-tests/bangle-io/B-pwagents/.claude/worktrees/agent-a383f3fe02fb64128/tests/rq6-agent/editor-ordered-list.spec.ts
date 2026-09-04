// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Ordered list from 1. markdown shorthand', () => {
  test('typing "1. " creates an ordered list with prosemirror-flat-list nodes', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-ordered-list');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    await page.locator('.ProseMirror[contenteditable="true"]').click();
    await page.keyboard.type('1. First ordered item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second ordered item');
    await page.keyboard.press('Enter');
    // Press Enter again to exit the list
    await page.keyboard.press('Enter');

    // The app uses flat list nodes with data-list-kind="ordered" instead of <ol>/<li>
    const listItems = page.locator('.ProseMirror [data-list-kind="ordered"]');
    await expect(listItems).toHaveCount(2);

    // First item contains "First ordered item"
    await expect(listItems.nth(0)).toContainText('First ordered item');

    // Second item contains "Second ordered item"
    await expect(listItems.nth(1)).toContainText('Second ordered item');
  });
});
