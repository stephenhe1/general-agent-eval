// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 12: Cancel Note Deletion', () => {
  test('cancel note deletion keeps the note intact', async ({ page }) => {
    // Step 1: Set up workspace ws-delete-cancel
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // Browser radio is pre-selected by default
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-delete-cancel');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(800);

    // Capture URL before any delete attempt
    const urlBefore = page.url();
    console.log('URL_BEFORE:', urlBefore);

    // Step 3: Open command palette with Meta+K, type 'Delete Note', click the command
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(400);

    const cmdInput = page.locator('input[placeholder*="Type a command" i], input[placeholder*="command or search" i]').first();
    await cmdInput.fill('Delete Note');
    await page.waitForTimeout(400);

    await page.getByRole('option', { name: /Delete Note/ }).click();
    await page.waitForTimeout(400);

    // Step 4: A list appears — click untitled-1.md
    await page.getByRole('option', { name: 'untitled-1.md' }).click();
    await page.waitForTimeout(400);

    // Step 5: A "Confirm Delete" dialog appears — click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();
    await page.waitForTimeout(500);

    // Postcondition: untitled-1.md still appears in the sidebar (note was NOT deleted)
    await expect(page.locator('button').filter({ hasText: 'untitled-1.md' }).first()).toBeVisible();

    // Postcondition: URL is unchanged
    expect(page.url()).toBe(urlBefore);
  });
});
