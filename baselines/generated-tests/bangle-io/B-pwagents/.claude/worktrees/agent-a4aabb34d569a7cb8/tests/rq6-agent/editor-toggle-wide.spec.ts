// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 16: Toggle Wide Editor', () => {
  test('Toggle Max Width button exists and editor remains functional after toggling', async ({ page }) => {
    // Set up workspace ws-wide-editor
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-wide-editor');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click New File to create untitled-1.md
    await page.getByTitle('New File').click();
    await expect(page.getByText('untitled-1.md')).toBeVisible();

    // Verify a Toggle Max Width button exists in the editor header
    const toggleButton = page.getByRole('button', { name: /Toggle.*[Mm]ax.*[Ww]idth|[Mm]ax.*[Ww]idth/i });
    await expect(toggleButton).toBeVisible();

    // Click Toggle Max Width once
    await toggleButton.click();

    // The toggle button still exists after first click
    await expect(page.getByRole('button', { name: /Toggle.*[Mm]ax.*[Ww]idth|[Mm]ax.*[Ww]idth/i })).toBeVisible();

    // Click Toggle Max Width again
    await page.getByRole('button', { name: /Toggle.*[Mm]ax.*[Ww]idth|[Mm]ax.*[Ww]idth/i }).click();

    // Postconditions: the toggle button still exists after toggling back
    await expect(page.getByRole('button', { name: /Toggle.*[Mm]ax.*[Ww]idth|[Mm]ax.*[Ww]idth/i })).toBeVisible();

    // The editor is still visible and editable (contenteditable is still present)
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    // Editor is still interactive - can click and type
    await editor.click();
    await page.keyboard.type('test content');
    await expect(editor).toContainText('test content');
  });
});
