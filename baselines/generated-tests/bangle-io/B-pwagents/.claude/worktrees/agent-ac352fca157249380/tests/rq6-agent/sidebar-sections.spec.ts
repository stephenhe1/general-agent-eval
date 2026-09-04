// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 36: Sidebar Shows Opened and Files Sections', () => {
  test('should show Opened and Files sections with both notes and a New File button', async ({ page }) => {
    // Set up workspace ws-sidebar-sections
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('radio', { name: /Browser/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-sidebar-sections');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-1/);
    await page.waitForTimeout(200);

    // Create untitled-2.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-2/);
    await page.waitForTimeout(200);

    // Postconditions: Sidebar has an "Opened" section
    const openedSection = page.locator('[data-sidebar="group"]').filter({ hasText: /Opened/ });
    await expect(openedSection).toBeVisible();
    // Opened section lists recently opened note (at minimum untitled-2.md)
    await expect(openedSection.locator('[href*="untitled-2.md"]')).toBeVisible();

    // Sidebar has a "Files" section listing all notes
    const filesSection = page.locator('[data-sidebar="group"]').filter({ hasText: /Files/ });
    await expect(filesSection).toBeVisible();
    await expect(filesSection.locator('[href*="untitled-1.md"]')).toBeVisible();
    await expect(filesSection.locator('[href*="untitled-2.md"]')).toBeVisible();

    // Files section has a New File action button
    await expect(filesSection.getByRole('button', { name: 'New File' })).toBeVisible();
  });
});
