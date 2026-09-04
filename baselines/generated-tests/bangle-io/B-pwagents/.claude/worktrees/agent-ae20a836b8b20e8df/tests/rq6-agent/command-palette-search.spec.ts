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

test.describe('Scenario 17: Search / Command Palette — Open and Find Notes', () => {
  test('opens palette from search button, filters notes, and closes on Escape', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-palette-search');

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File', exact: true }).first().click();
    await page.waitForURL(/editor/);

    // Step 3: Click the search button in the sidebar to open the command palette
    await page.getByRole('button', { name: /Search/ }).click();

    // Step 4: Verify the command palette dialog opens
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();

    // Step 5: Type `untitled` in the palette input
    await page.getByRole('combobox').fill('untitled');

    // Step 6: Verify results show untitled-1.md
    await expect(page.getByRole('option', { name: 'untitled-1.md' })).toBeVisible();

    // Step 7: Press Escape
    await page.keyboard.press('Escape');

    // Step 8: Verify the palette is closed
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
