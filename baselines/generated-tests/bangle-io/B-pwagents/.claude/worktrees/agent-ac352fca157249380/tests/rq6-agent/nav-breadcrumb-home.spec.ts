// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 27: Navigate via Breadcrumb Home Icon', () => {
  test('should navigate to home via breadcrumb home icon', async ({ page }) => {
    // Set up workspace ws-breadcrumb-home
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('radio', { name: /Browser/ }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-breadcrumb-home');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Create a note so we are on the editor page
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForURL(/untitled-1/);

    // Verify we are on the editor page
    await expect(page).toHaveURL(/route=editor/);

    // Click the home icon link in the breadcrumb (title="Home")
    await page.locator('a[title="Home"]').click();
    await page.waitForTimeout(500);

    // Postconditions: URL changes to home route
    await expect(page).toHaveURL(/route=welcome|route=ws-home/);

    // Workspace home page or welcome page is displayed
    const bodyText = await page.locator('body').innerText();
    const isWelcome = bodyText.includes('Welcome to Bangle') || bodyText.includes('Create Workspace');
    const isWsHome = bodyText.includes('ws-breadcrumb-home');
    expect(isWelcome || isWsHome).toBeTruthy();
  });
});
