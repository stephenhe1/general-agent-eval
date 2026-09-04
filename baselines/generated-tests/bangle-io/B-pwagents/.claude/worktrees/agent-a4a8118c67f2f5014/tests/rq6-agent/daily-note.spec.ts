// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 22: Open Daily Note', () => {
  test('opens today\'s daily note via command palette', async ({ page }) => {
    // Set up workspace ws-daily-note
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const browserBtn = page.getByRole('button', { name: 'Browser' });
    if (await browserBtn.isVisible()) {
      await browserBtn.click();
    }
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
    }
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-daily-note');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Open the command palette via keyboard shortcut
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);

    // Type "Open Daily Note" to filter commands
    await page.keyboard.type('Open Daily Note');
    await page.waitForTimeout(300);

    // Click the Open Daily Note command
    const dailyNoteOption = page.getByRole('option', { name: /Open Daily Note/i });
    await expect(dailyNoteOption).toBeVisible();
    await dailyNoteOption.click();

    // Wait for navigation
    await page.waitForTimeout(500);

    // Postcondition: URL contains 'daily' in the wsPath
    await expect(page).toHaveURL(/daily/);

    // Postcondition: A contenteditable editor is visible
    await expect(page.locator('[contenteditable]')).toBeVisible();

    // Postcondition: Sidebar Files section shows the daily note file
    // The sidebar shows the daily note as a link
    await expect(page.getByRole('link', { name: /daily/ })).toBeVisible();
  });
});
