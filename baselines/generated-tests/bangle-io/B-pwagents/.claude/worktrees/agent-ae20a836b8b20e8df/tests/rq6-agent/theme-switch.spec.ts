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

async function openPaletteAndSearchSwitchTheme(page: any) {
  await page.getByRole('button', { name: /Search/ }).click();
  await page.getByRole('combobox').fill('Switch Theme');
  await expect(page.getByRole('option', { name: /Switch Theme/i })).toBeVisible();
  await page.getByRole('option', { name: /Switch Theme/i }).first().click();
}

test.describe('Scenario 19: Switch Theme (Dark/Light/System)', () => {
  test('switching to Dark applies dark scheme; switching to Light removes it', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-theme-switch');

    // Step 2: Open the command palette
    await openPaletteAndSearchSwitchTheme(page);

    // Step 3: A submenu appears with System, Light, Dark options — click Dark
    await expect(page.getByRole('option', { name: 'Dark' })).toBeVisible();
    await page.getByRole('option', { name: 'Dark' }).click();

    // Step 4: Verify dark mode is applied — html element has BU_dark-scheme class
    await expect(page.locator('html')).toHaveClass(/BU_dark-scheme/);

    // Step 5: Open palette again, type Switch Theme, click it, click Light
    await openPaletteAndSearchSwitchTheme(page);
    await expect(page.getByRole('option', { name: 'Light' })).toBeVisible();
    await page.getByRole('option', { name: 'Light' }).click();

    // Step 6: Verify light mode is applied — BU_dark-scheme class is gone
    await expect(page.locator('html')).not.toHaveClass(/BU_dark-scheme/);
    await expect(page.locator('html')).toHaveClass(/BU_light-scheme/);
  });
});
