// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Clicking a task checkbox toggles its checked state', () => {
  test('task list checkbox can be toggled from unchecked to checked', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-checkbox-toggle');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    await page.locator('.ProseMirror[contenteditable="true"]').click();
    await page.keyboard.type('- [ ] Click me task');
    await page.keyboard.press('Enter');

    // Wait for the task list item to appear
    const taskItem = page.locator('.ProseMirror [data-list-kind="task"]').first();
    await expect(taskItem).toBeVisible();

    // Locate the checkbox inside the task item
    const checkbox = taskItem.locator('input[type="checkbox"]');

    // Assert it is unchecked initially
    await expect(checkbox).not.toBeChecked();

    // Click the checkbox to toggle it
    await checkbox.click();

    // Assert it is now checked
    await expect(checkbox).toBeChecked();

    // Assert the task item has the checked attribute
    await expect(taskItem).toHaveAttribute('data-list-checked', '');

    // Task text should still be visible
    await expect(page.locator('.ProseMirror')).toContainText('Click me task');
  });
});
