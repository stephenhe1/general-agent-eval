// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create Multiple Notes with Auto-Incrementing Names', () => {
  test('Auto-increment note filenames when creating multiple untitled notes', async ({ page }) => {
    // Step 1: Set up workspace ws-autoincrement using the setup helper
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-autoincrement');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Step 2: Click the New File button in the sidebar - note URL ends with untitled-1.md
    await page.getByTitle('New File').click();
    await page.waitForURL(/untitled-1\.md/);
    expect(page.url()).toContain('untitled-1.md');

    // Step 3: Click the New File button again - note URL ends with untitled-2.md
    await page.getByTitle('New File').click();
    await page.waitForURL(/untitled-2\.md/);

    // Postcondition: Second note URL contains untitled-2.md
    expect(page.url()).toContain('untitled-2.md');

    // Postcondition: Currently open note is untitled-2.md
    await expect(page.getByText('untitled-2.md').first()).toBeVisible();

    // Postcondition: Sidebar Files section shows both untitled-1.md and untitled-2.md
    await expect(page.getByRole('link', { name: 'untitled-1.md' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'untitled-2.md' })).toBeVisible();
  });
});
