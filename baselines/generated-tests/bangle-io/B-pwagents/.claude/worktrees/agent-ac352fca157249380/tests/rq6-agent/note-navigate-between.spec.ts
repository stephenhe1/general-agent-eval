// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 7: Navigate Between Notes', () => {
  test('should navigate between two notes using sidebar links', async ({ page }) => {
    // Set up workspace ws-navigate
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('radio', { name: /Browser/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-navigate');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Create untitled-1.md and type content
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-1/);
    await page.locator('[contenteditable="true"]').click();
    await page.keyboard.type('Content of note one');
    await page.waitForTimeout(300);

    // Create untitled-2.md and type content
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-2/);
    await page.locator('[contenteditable="true"]').click();
    await page.keyboard.type('Content of note two');
    await page.waitForTimeout(300);

    // Click untitled-1.md link in sidebar Files section
    const filesSection = page.locator('[data-sidebar="group"]').filter({ hasText: /Files/ });
    await filesSection.locator('[href*="untitled-1.md"]').click();
    await page.waitForTimeout(500);

    // Postconditions
    // URL contains untitled-1.md
    await expect(page).toHaveURL(/untitled-1\.md/);

    // Editor shows "Content of note one"
    const editorContent = await page.locator('[contenteditable="true"]').innerText();
    expect(editorContent).toContain('Content of note one');

    // Breadcrumb shows untitled-1.md
    await expect(page.locator('nav[aria-label*="breadcrumb"]')).toContainText('untitled-1.md');

    // Both notes are still in the sidebar (Files section)
    await expect(filesSection.locator('[href*="untitled-1.md"]')).toBeVisible();
    await expect(filesSection.locator('[href*="untitled-2.md"]')).toBeVisible();
  });
});
