// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 23: Create Directory', () => {
  test('creates a new directory via command palette', async ({ page }) => {
    // Set up workspace ws-create-dir
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const browserBtn = page.getByRole('button', { name: 'Browser' });
    if (await browserBtn.isVisible()) {
      await browserBtn.click();
    }
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
    }
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-create-dir');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Open the command palette
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // Type "New Directory" to filter commands
    await page.keyboard.type('New Directory');
    await page.waitForTimeout(300);

    // Click the New Directory command
    const newDirOption = page.getByRole('option', { name: /New Directory/i });
    await expect(newDirOption).toBeVisible();
    await newDirOption.click();
    await page.waitForTimeout(300);

    // A dialog opens with an input for the directory name
    await expect(page.getByRole('dialog')).toBeVisible();
    const dirInput = page.locator('input[placeholder="Input directory name"]');
    await expect(dirInput).toBeVisible();

    // Type the directory name
    await dirInput.fill('my-folder');
    await page.waitForTimeout(200);

    // Press Enter to confirm creation (triggers the "Create" option in the listbox)
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Postcondition: the dialog closes
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Postcondition: my-folder appears in the sidebar file tree
    await expect(page.getByRole('button', { name: 'my-folder' }).first()).toBeVisible();
  });
});
