// spec: specs/plan-core.md
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scenario 8: Open Note via Breadcrumb Dropdown', () => {
  test('navigate to another note via breadcrumb dropdown menu', async ({ page }) => {
    // Set up workspace ws-breadcrumb-picker
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const browserBtn = page.getByRole('button', { name: 'Browser' });
    if (await browserBtn.isVisible()) {
      await browserBtn.click();
    }
    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
    }
    await page.getByRole('textbox', { name: 'Workspace Name' }).fill('ws-breadcrumb-picker');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/ws-home/);

    // Click New File to create untitled-1.md
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(500);

    // Click New File to create untitled-2.md (now viewing note 2)
    await page.getByRole('button', { name: 'New File' }).click();
    await page.waitForTimeout(500);

    // Confirm we are viewing untitled-2.md
    await expect(page).toHaveURL(/untitled-2/);

    // Click the breadcrumb button in the header that shows the note filename
    // It has aria-haspopup="menu" and is inside the <header> element
    const breadcrumbBtn = page.getByLabel('breadcrumb').getByRole('button', { name: /untitled/ });
    await expect(breadcrumbBtn).toBeVisible();

    // Verify aria-haspopup="menu"
    await expect(breadcrumbBtn).toHaveAttribute('aria-haspopup', 'menu');

    // Click it to open the dropdown
    await breadcrumbBtn.click();
    await page.waitForTimeout(300);

    // Verify a dropdown menu appears
    await expect(page.locator('[role="menuitem"]', { hasText: 'untitled-1.md' })).toBeVisible();
    await expect(page.locator('[role="menuitem"]', { hasText: 'untitled-2.md' })).toBeVisible();

    // Click untitled-1.md in the dropdown
    await page.locator('[role="menuitem"]', { hasText: 'untitled-1.md' }).click();
    await page.waitForTimeout(300);

    // Postcondition: URL changes to untitled-1.md editor route
    await expect(page).toHaveURL(/untitled-1/);

    // Postcondition: Breadcrumb updates to untitled-1.md
    await expect(page.getByLabel('breadcrumb').getByRole('button', { name: /untitled-1/ })).toBeVisible();
  });
});
