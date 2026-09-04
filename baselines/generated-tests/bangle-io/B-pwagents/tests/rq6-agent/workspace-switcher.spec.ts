// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 25: Workspace Switcher', () => {
  test('switch between workspaces using the workspace switcher', async ({ page }) => {
    // Set up workspace ws-switcher-a
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const browserBtnA = page.getByRole('button', { name: 'Browser' });
    if (await browserBtnA.isVisible()) {
      await browserBtnA.click();
    }
    const nextBtnA = page.getByRole('button', { name: 'Next' });
    if (await nextBtnA.isVisible()) {
      await nextBtnA.click();
    }
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-switcher-a');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click the workspace name button in the sidebar (the first aria-haspopup="menu" button)
    const wsSwitcherBtn = page.locator('button[aria-haspopup="menu"]').first();
    await expect(wsSwitcherBtn).toBeVisible();
    await wsSwitcherBtn.click();
    await page.waitForTimeout(300);

    // A dropdown appears - verify it lists ws-switcher-a and a New Workspace option
    await expect(page.locator('[role="menuitem"]', { hasText: 'ws-switcher-a' })).toBeVisible();
    await expect(page.locator('[role="menuitem"]', { hasText: 'New Workspace' })).toBeVisible();

    // Click New Workspace
    await page.locator('[role="menuitem"]', { hasText: 'New Workspace' }).click();
    await page.waitForTimeout(500);

    // Follow workspace creation flow: Browser -> Next -> fill ws-switcher-b -> Create
    const browserBtnB = page.getByRole('button', { name: 'Browser' });
    if (await browserBtnB.isVisible()) {
      await browserBtnB.click();
    }
    const nextBtnB = page.getByRole('button', { name: 'Next' });
    if (await nextBtnB.isVisible()) {
      await nextBtnB.click();
    }
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-switcher-b');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Postcondition: sidebar shows ws-switcher-b as active workspace
    await expect(page).toHaveURL(/ws-switcher-b/);
    await expect(page.locator('button[aria-haspopup="menu"]').first()).toContainText('ws-switcher-b');

    // Click the workspace switcher again
    await page.locator('button[aria-haspopup="menu"]').first().click();
    await page.waitForTimeout(300);

    // Click ws-switcher-a to switch back
    await expect(page.locator('[role="menuitem"]', { hasText: 'ws-switcher-a' })).toBeVisible();
    await page.locator('[role="menuitem"]', { hasText: 'ws-switcher-a' }).click();
    await page.waitForTimeout(500);

    // Postcondition: URL changes to ws-home for ws-switcher-a
    await expect(page).toHaveURL(/ws-switcher-a/);
    await expect(page).toHaveURL(/ws-home/);
  });
});
