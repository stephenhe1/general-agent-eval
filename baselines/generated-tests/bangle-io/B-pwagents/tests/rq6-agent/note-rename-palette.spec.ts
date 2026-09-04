// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

async function setupWorkspace(page: any, wsName: string) {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page.getByRole('radio', { name: /Browser/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Workspace Name' }).fill(wsName);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/ws-home/);
}

test.describe('Scenario 10: Rename Note via Command Palette', () => {
  test('renames the current note through the Rename Note palette command', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-rename-palette');

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File', exact: true }).first().click();
    await page.waitForURL(/editor/);

    // Step 3: Open the command palette
    await page.getByRole('button', { name: /Search/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Step 4: Type `Rename Note`
    await page.getByRole('combobox').fill('Rename');
    await expect(page.getByRole('option', { name: /Rename Note/i })).toBeVisible();

    // Step 5: Click the Rename Note command
    await page.getByRole('option', { name: /Rename Note/i }).first().click();

    // Step 6: The rename dialog opens with the current name pre-filled
    const renameDialog = page.getByRole('dialog');
    await expect(renameDialog).toBeVisible();
    await expect(renameDialog).toContainText('Renaming');
    // Verify the input is pre-filled with "untitled-1"
    const renameInput = renameDialog.getByRole('combobox');
    await expect(renameInput).toHaveValue('untitled-1');

    // Step 7: Clear the input and type `renamed-via-palette`
    await renameInput.clear();
    await renameInput.fill('renamed-via-palette');

    // Step 8: Press Enter to confirm
    await page.keyboard.press('Enter');

    // Postcondition: URL contains `renamed-via-palette.md`
    await page.waitForURL(/renamed-via-palette/);
    expect(page.url()).toContain('renamed-via-palette.md');

    // Postcondition: Breadcrumb shows `renamed-via-palette.md`
    await expect(page.locator('text=renamed-via-palette.md').first()).toBeVisible();

    // Postcondition: Sidebar shows `renamed-via-palette.md`
    await expect(
      page.locator('[data-sidebar], nav, aside').filter({ hasText: 'renamed-via-palette.md' }).first()
    ).toBeVisible();
  });
});
