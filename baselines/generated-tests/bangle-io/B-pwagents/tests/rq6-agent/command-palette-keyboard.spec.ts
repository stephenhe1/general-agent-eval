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

test.describe('Scenario 18: Open Command Palette with Keyboard Shortcut', () => {
  test('Meta+K opens command palette; Escape dismisses it', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-palette-keyboard');

    // Step 2: Click New File to create untitled-1.md (to have an active page)
    await page.getByRole('button', { name: 'New File', exact: true }).first().click();
    await page.waitForURL(/editor/);

    // Step 3: Press Meta+K (Cmd+K)
    await page.keyboard.press('Meta+k');

    // Step 4: Verify the command palette dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();

    // Step 5: Press Escape
    await page.keyboard.press('Escape');

    // Step 6: Verify the palette is closed
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
