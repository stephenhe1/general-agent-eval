// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 20: Workspace Home Shows Recent Notes', () => {
  test('workspace home displays recent notes after creating files', async ({ page }) => {
    // Set up workspace ws-recent-notes
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
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-recent-notes');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(500);

    // Click New File to create untitled-2.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(500);

    // Navigate to workspace home
    await page.goto('http://127.0.0.1:5173/ws#route=ws-home&wsName=ws-recent-notes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // Postcondition: workspace home shows a "Recent notes" section
    await expect(page.getByRole('heading', { name: 'Recent notes' })).toBeVisible();

    // Postcondition: both files appear in the recent notes list
    await expect(page.getByRole('button', { name: 'untitled-2.md' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'untitled-1.md' })).toBeVisible();

    // Postcondition: New Note and Switch Workspace buttons are visible
    await expect(page.getByRole('button', { name: 'New Note' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Switch Workspace' })).toBeVisible();
  });
});
