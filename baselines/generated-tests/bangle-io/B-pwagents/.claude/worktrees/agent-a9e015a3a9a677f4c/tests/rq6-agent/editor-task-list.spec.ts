// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task list from - [ ] markdown shorthand', () => {
  test('types - [ ] and - [x] shorthand to render task list items', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-task-list');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);
    await page.locator('[title="New File"]').click();
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await editor.waitFor();

    await editor.click();
    await page.keyboard.type('- [ ] Unchecked task');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- [x] Checked task');
    await page.keyboard.press('Enter');

    // The app renders task items as prosemirror-flat-list elements with data-list-kind="task"
    const taskItems = page.locator('.ProseMirror [data-list-kind="task"]');
    // At least 2 task items should exist (a 3rd empty one is created after the second Enter)
    expect(await taskItems.count()).toBeGreaterThanOrEqual(2);

    // Verify content of the first two task items
    await expect(taskItems.nth(0)).toContainText('Unchecked task');
    await expect(taskItems.nth(1)).toContainText('Checked task');

    // Verify each task item has a checkbox input
    const checkboxInFirst = taskItems.nth(0).locator('input[type="checkbox"]');
    const checkboxInSecond = taskItems.nth(1).locator('input[type="checkbox"]');
    await expect(checkboxInFirst).toHaveCount(1);
    await expect(checkboxInSecond).toHaveCount(1);

    // The unchecked task has an unchecked checkbox
    await expect(checkboxInFirst).not.toBeChecked();
  });
});
