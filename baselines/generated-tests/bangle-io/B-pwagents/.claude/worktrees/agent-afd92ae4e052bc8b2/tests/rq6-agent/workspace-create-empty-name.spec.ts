// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Workspace Creation Requires Non-Empty Name', () => {
  test('Verify that workspace creation requires a name', async ({ page }) => {
    // Step 1: Navigate to the app root
    await page.goto('http://127.0.0.1:5173/');

    // Step 2: Click Create Workspace
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    // Step 3: Click Browser
    await page.getByRole('button', { name: 'Browser' }).click();

    // Step 4: Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5: Observe the Create button with the input empty
    await expect(page.getByLabel('Workspace Name')).toBeVisible();

    // Postcondition: Create button is disabled when input is empty
    await expect(page.getByRole('button', { name: 'Create' })).toBeDisabled();

    // Step 6: Fill the input with ws-name-validation
    await page.getByLabel('Workspace Name').fill('ws-name-validation');

    // Step 7: Observe the Create button again
    // Postcondition: Create button is enabled after typing a name
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();
  });
});
