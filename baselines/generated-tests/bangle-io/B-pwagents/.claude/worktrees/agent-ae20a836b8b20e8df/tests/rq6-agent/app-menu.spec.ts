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

test.describe('Scenario 29: Bangle.io App Menu', () => {
  test('clicking Bangle.io opens a menu with New, App Actions, and Links sections', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-app-menu');

    // Step 2: Click the "Bangle.io" button in the sidebar footer
    await page.getByRole('button', { name: 'Bangle.io' }).click();

    // Step 3: Verify a menu opens
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Step 4: Verify menu contains sections: "New", "App Actions", "Links"
    await expect(menu).toContainText('New');
    await expect(menu).toContainText('App Actions');
    await expect(menu).toContainText('Links');

    // Step 5: Verify the menu has required items
    await expect(page.getByRole('menuitem', { name: 'New Note' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'New Workspace' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Change Theme' })).toBeVisible();
    // "Omni Search" is labelled as such in the App Actions section
    await expect(menu).toContainText(/Omni Search|All Commands/);

    // Step 6: Press Escape to close
    await page.keyboard.press('Escape');

    // Step 7: Verify menu is dismissed
    await expect(menu).not.toBeVisible();
  });
});
