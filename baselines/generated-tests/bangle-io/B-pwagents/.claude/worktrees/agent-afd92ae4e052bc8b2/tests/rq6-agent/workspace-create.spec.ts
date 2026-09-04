// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Create Workspace (Browser Storage)', () => {
  test('Create a new browser-storage workspace from the welcome screen', async ({ page }) => {
    // Step 1: Navigate to the app root
    await page.goto('http://127.0.0.1:5173/');

    // Step 2: Verify the welcome page shows "Welcome to Bangle" and a Create Workspace button
    await expect(page.getByText('Welcome to Bangle')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeVisible();

    // Step 3: Click Create Workspace
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // Step 4: Click Browser
    await page.getByRole('button', { name: 'Browser' }).click();

    // Step 5: Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 6: Verify the dialog shows a Workspace Name input
    await expect(page.getByLabel('Workspace Name')).toBeVisible();

    // Step 7: Verify the Create button is disabled when input is empty
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();

    // Step 8: Fill the input with ws-create-test
    await page.getByLabel('Workspace Name').fill('ws-create-test');

    // Step 9: Verify Create button becomes enabled
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    // Step 10: Click Create
    await page.getByRole('button', { name: 'Create' }).click();

    // Step 11: Wait for navigation to the workspace home
    await page.waitForURL(/ws-home/);

    // Postcondition: URL matches ws-home route with wsName=ws-create-test
    expect(page.url()).toContain('ws-home');
    expect(page.url()).toContain('ws-create-test');

    // Postcondition: Sidebar shows ws-create-test as workspace name
    await expect(page.getByText('ws-create-test')).toBeVisible();

    // Postcondition: Main area shows "No notes found in this workspace."
    await expect(page.getByText('No notes found in this workspace.')).toBeVisible();
  });
});
