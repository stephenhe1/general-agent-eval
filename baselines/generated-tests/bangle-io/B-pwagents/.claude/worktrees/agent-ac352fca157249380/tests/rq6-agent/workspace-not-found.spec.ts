// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 28: Workspace Not Found Error State', () => {
  test('should show Workspace Not Found page for a nonexistent workspace', async ({ page }) => {
    // Navigate to a nonexistent workspace
    await page.goto('http://127.0.0.1:5173/ws#route=ws-home&wsName=nonexistent-workspace-xyz-123');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Postconditions: page shows "Workspace Not Found" heading
    await expect(page.getByRole('heading', { name: 'Workspace Not Found' })).toBeVisible();

    // Create Workspace and/or Switch Workspace buttons are present
    const createWsBtn = page.getByRole('button', { name: 'Create Workspace' });
    const switchWsBtn = page.getByRole('button', { name: 'Switch Workspace' });
    const hasCreate = await createWsBtn.isVisible();
    const hasSwitch = await switchWsBtn.isVisible();
    expect(hasCreate || hasSwitch).toBeTruthy();
  });
});
