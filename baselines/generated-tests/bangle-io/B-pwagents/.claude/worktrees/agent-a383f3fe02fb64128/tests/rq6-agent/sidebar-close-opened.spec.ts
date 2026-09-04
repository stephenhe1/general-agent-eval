// spec: specs/plan-editor.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Sidebar file close button removes note from Opened section', () => {
  test('the Opened section shows the current note; navigating to a new note updates the Opened section', async ({ page }) => {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-sidebar-close');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Create first note (untitled-1.md)
    await page.locator('[title="New File"]').click();
    await page.locator('.ProseMirror[contenteditable="true"]').waitFor();
    await page.waitForTimeout(300);

    // Create second note (untitled-2.md) — this becomes the active note
    await page.locator('[title="New File"]').click();
    await page.waitForTimeout(500);

    // Both files should appear in the Files section
    const filesGroup = page.locator('[data-sidebar="group"]:has([data-sidebar="group-label"]:has-text("Files"))');
    await expect(filesGroup).toContainText('untitled-1.md');
    await expect(filesGroup).toContainText('untitled-2.md');

    // The Opened section shows the currently active note (untitled-2.md)
    const openedGroup = page.locator('[data-sidebar="group"]:has([data-sidebar="group-label"]:has-text("Opened"))');
    await expect(openedGroup).toContainText('untitled-2.md');

    // Navigate to untitled-1.md — now the Opened section should update to show untitled-1.md
    await filesGroup.locator('[data-sidebar="menu-button"]:has-text("untitled-1.md")').click();
    await page.waitForTimeout(500);

    // Opened section now shows untitled-1.md
    await expect(openedGroup).toContainText('untitled-1.md');

    // Navigate back to ws-home — the Opened section reflects no active note
    // The Files section still has both notes
    await page.goto('http://127.0.0.1:5173/ws#route=ws-home&wsName=ws-sidebar-close');
    await page.waitForTimeout(500);

    // Both files are still present in the Files section
    await expect(filesGroup).toContainText('untitled-1.md');
    await expect(filesGroup).toContainText('untitled-2.md');
  });
});
