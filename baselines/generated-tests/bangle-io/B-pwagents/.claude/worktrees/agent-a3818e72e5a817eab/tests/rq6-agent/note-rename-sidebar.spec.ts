// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 9: Rename Note via Sidebar Three-Dot Menu', () => {
  test('rename note via sidebar three-dot menu', async ({ page }) => {
    // Step 1: Set up workspace ws-rename-sidebar
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    // Browser radio is pre-selected by default; click Next
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-rename-sidebar');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click New File button to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(1000);

    // Step 3: In sidebar Files section, find the three-dot action button next to untitled-1.md
    // The button has data-sidebar="menu-action" and is revealed on hover; use force: true
    const threeDotBtn = page.locator('button[data-sidebar="menu-action"]').first();
    await threeDotBtn.click({ force: true });

    // Step 4: A context menu appears — click Rename
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await page.waitForTimeout(300);

    // Step 5: A dialog opens labeled "Renaming" with a combobox pre-filled with 'untitled-1'
    const renameCombobox = page.getByRole('combobox');
    await expect(renameCombobox).toHaveValue('untitled-1');

    // Step 6: Clear the input and type 'my-renamed-note'
    await renameCombobox.clear();
    await renameCombobox.fill('my-renamed-note');

    // Step 7: Press Enter
    await page.keyboard.press('Enter');

    // Step 8: Wait for navigation
    await page.waitForURL(/my-renamed-note\.md/);

    // Postcondition: URL contains my-renamed-note.md
    expect(page.url()).toContain('my-renamed-note.md');

    // Postcondition: Breadcrumb shows my-renamed-note.md
    const breadcrumb = page.locator('nav[aria-label="breadcrumb"]');
    await expect(breadcrumb).toContainText('my-renamed-note.md');

    // Postcondition: Sidebar shows my-renamed-note.md, not untitled-1.md
    const renamedBtn = page.getByRole('button', { name: /my-renamed-note\.md/ });
    await expect(renamedBtn.first()).toBeVisible();
    const originalBtn = page.getByRole('button', { name: 'untitled-1.md' });
    await expect(originalBtn).toHaveCount(0);
  });
});
