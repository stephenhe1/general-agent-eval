// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create Note via Sidebar New File Button', () => {
  test('Create a new note using the sidebar New File button', async ({ page }) => {
    // Step 1: Set up workspace ws-newfile-btn using the setup helper
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-newfile-btn');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click the button with title="New File" in the sidebar
    await page.getByTitle('New File').click();

    // Step 3: Wait for navigation to the new note
    await page.waitForURL(/editor/);

    // Postcondition: URL contains ws-newfile-btn and untitled-1.md
    expect(page.url()).toContain('ws-newfile-btn');
    expect(page.url()).toContain('untitled-1.md');

    // Postcondition: Breadcrumb shows untitled-1.md
    await expect(page.getByText('untitled-1.md')).toBeVisible();

    // Postcondition: A contenteditable editor is visible
    await expect(page.locator('[contenteditable="true"]')).toBeVisible();

    // Postcondition: Sidebar Files section shows untitled-1.md
    await expect(page.getByRole('link', { name: 'untitled-1.md' })).toBeVisible();
  });
});
