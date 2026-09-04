// spec: specs/plan-core.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Scenario 15: Star/Unstar a Note', () => {
  test('star and unstar button aria-label toggles correctly', async ({ page }) => {
    // Set up workspace ws-star-unstar
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Create Workspace' }).click();
    await page.getByRole('button', { name: 'Browser' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Workspace Name').fill('ws-star-unstar');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click New File to create untitled-1.md
    await page.getByTitle('New File').click();
    await expect(page.getByText('untitled-1.md')).toBeVisible();

    // Observe the "Star this item" button in the editor header
    const starButton = page.getByRole('button', { name: 'Star this item' });
    await expect(starButton).toBeVisible();

    // Click the Star this item button
    await starButton.click();

    // Postcondition: after starring, button aria-label is "Unstar this item"
    await expect(page.getByRole('button', { name: 'Unstar this item' })).toBeVisible();

    // Click again (Unstar)
    await page.getByRole('button', { name: 'Unstar this item' }).click();

    // Postcondition: after unstarring, button aria-label is "Star this item"
    await expect(page.getByRole('button', { name: 'Star this item' })).toBeVisible();
  });
});
