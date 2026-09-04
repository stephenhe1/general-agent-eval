// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

async function setupWorkspace(page: any, wsName: string) {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Create Workspace' }).click();
  await page.getByRole('radio', { name: /Browser/ }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Workspace Name' }).fill(wsName);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/ws-home/);
}

test.describe('Scenario 35: Go to Workspace Home Command', () => {
  test('Go to Workspace Home command navigates back to ws-home', async ({ page }) => {
    // Step 1: Set up workspace
    await setupWorkspace(page, 'ws-goto-home');

    // Step 2: Click New File to create untitled-1.md (now on editor page)
    await page.getByRole('button', { name: 'New File', exact: true }).first().click();
    await page.waitForURL(/editor/);
    expect(page.url()).toContain('route=editor');

    // Step 3: Open the command palette
    await page.getByRole('button', { name: /Search/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Step 4: Type `Go to Workspace Home`
    await page.getByRole('combobox').fill('Go to Workspace');
    await expect(page.getByRole('option', { name: /Go to Workspace Home/i })).toBeVisible();

    // Step 5: Click the Go to Workspace Home command
    await page.getByRole('option', { name: /Go to Workspace Home/i }).first().click();

    // Postcondition: URL changes to ws-home route for ws-goto-home
    await page.waitForURL(/ws-home/);
    expect(page.url()).toContain('route=ws-home');
    expect(page.url()).toContain('ws-goto-home');

    // Postcondition: Workspace home page is shown (h2 heading on ws-home page)
    await expect(page.locator('h2').filter({ hasText: 'ws-goto-home' })).toBeVisible();
  });
});
