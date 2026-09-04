// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 11: Delete Note via Command Palette (with Confirmation)', () => {
  test('delete note via command palette with confirmation', async ({ page }) => {
    // Step 1: Set up workspace ws-delete-palette
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // Browser radio is pre-selected by default
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-delete-palette');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(800);

    // Step 3: Click New File to create untitled-2.md (now we have 2 notes)
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(800);

    // Step 4: Open the command palette with Meta+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(400);

    // Step 5: Type 'Delete Note' in the command palette
    const cmdInput = page.locator('input[placeholder*="Type a command" i], input[placeholder*="command or search" i]').first();
    await cmdInput.fill('Delete Note');
    await page.waitForTimeout(400);

    // Step 6: Click the Delete Note command (prefixed with '>')
    await page.getByRole('option', { name: /Delete Note/ }).click();
    await page.waitForTimeout(400);

    // Step 7: A list appears — click untitled-1.md
    await page.getByRole('option', { name: 'untitled-1.md' }).click();
    await page.waitForTimeout(400);

    // Step 8: A confirmation dialog appears (Cancel and Delete buttons) — click Delete
    await page.getByRole('button', { name: /^delete$/i }).click();

    // Step 9: Wait for navigation
    await page.waitForTimeout(1500);

    // Postcondition: untitled-1.md no longer appears in the sidebar
    await expect(page.getByRole('button', { name: /untitled-1\.md/ })).toHaveCount(0);

    // Postcondition: untitled-2.md still appears in the sidebar
    // Use text locator since the button may include extra text
    await expect(page.locator('button').filter({ hasText: 'untitled-2.md' }).first()).toBeVisible();
  });
});
