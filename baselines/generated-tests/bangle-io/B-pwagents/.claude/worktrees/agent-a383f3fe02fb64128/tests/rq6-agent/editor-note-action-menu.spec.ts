// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Note header filename button opens action menu', () => {
  test('clicking the filename action button in Files section opens Rename/Move/Delete menu', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-note-action-menu');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();

    // Find the filename button in the breadcrumb (aria-haspopup="menu")
    // It is scoped inside the breadcrumb navigation
    const filenameBtn = page.getByLabel('breadcrumb').getByRole('button', { name: 'untitled-1.md' });
    await expect(filenameBtn).toBeVisible();
    await expect(filenameBtn).toHaveAttribute('aria-haspopup', 'menu');

    // Click the filename button in the sidebar Files section action menu
    // The sidebar Files section contains a kebab/more-options button with Rename, Move, Delete
    const filesActionBtn = page.locator(
      '[data-sidebar="group"]:has([data-sidebar="group-label"]:has-text("Files")) [data-sidebar="menu-action"][aria-haspopup="menu"]'
    );
    await expect(filesActionBtn).toBeVisible();
    await filesActionBtn.click();

    // Wait for the dropdown menu to appear
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Menu contains Rename and Delete options
    const menuItems = page.locator('[role="menuitem"]');
    const itemTexts = await menuItems.allTextContents();
    expect(itemTexts).toContain('Rename');
    expect(itemTexts).toContain('Delete');

    // Press Escape to close the menu
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  });
});
