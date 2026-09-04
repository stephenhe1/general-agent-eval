// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 13: Delete Note via Sidebar Three-Dot Menu', () => {
  test('delete note via sidebar three-dot menu with confirmation', async ({ page }) => {
    // Step 1: Set up workspace ws-delete-sidebar
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // Browser radio is pre-selected by default
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-delete-sidebar');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(800);

    // Step 3: In sidebar Files section, click the three-dot action button
    // The button has data-sidebar="menu-action" and is hover-revealed; use force: true
    await page.locator('button[data-sidebar="menu-action"]').first().click({ force: true });
    await page.waitForTimeout(400);

    // Step 4: Click Delete in the context menu
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.waitForTimeout(400);

    // A delete dialog opens with untitled-1.md pre-selected and "Press Enter or Click to delete"
    // Press Enter to trigger the confirmation step
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Step 5: A confirmation dialog appears (Cancel and Delete buttons) — click Delete
    await page.getByRole('button', { name: /^delete$/i }).click();
    await page.waitForTimeout(1500);

    // Postcondition: untitled-1.md is removed from the sidebar
    await expect(page.getByRole('button', { name: /untitled-1\.md/ })).toHaveCount(0);

    // Postcondition: "No notes found in this workspace." appears (only note was deleted)
    await expect(page.getByText(/no notes found/i)).toBeVisible();
  });
});
