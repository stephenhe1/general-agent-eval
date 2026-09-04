// spec: specs/event-management-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('/login/');
  await page.getByRole('textbox', { name: 'Username or email' }).fill('admin@admin.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('webtestpilot');
  await page.getByRole('button', { name: /Login/ }).click();
  await page.waitForLoadState('domcontentloaded');
}

async function createMeeting(page: any, title: string) {
  await page.goto('/category/0/manage/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    const el = document.getElementById('create-meeting') as HTMLElement | null;
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('#event-creation-title', { timeout: 15000 });
  await page.locator('#event-creation-title').fill(title);
  await page.locator('input[type="submit"][value="Create event"]').click();
  await page.waitForURL(/\/event\/\d+\/manage\//, { timeout: 20000 });
  // Extract event ID from URL
  const url = page.url();
  return url.match(/\/event\/(\d+)\/manage\//)?.[1];
}

test.describe('Event Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Edit Event Title', async ({ page }) => {
    // Create a fresh meeting to edit (avoid contaminating seeded events)
    const originalTitle = `Edit Test ${Date.now()}`;
    const newTitle = `Edited ${Date.now()}`;
    await createMeeting(page, originalTitle);

    // Wait for management page, then click edit button
    await page.getByTitle('Edit basic event data').click();

    // Wait for the inline form to load with the title input
    await page.waitForSelector('#title', { timeout: 10000 });
    // Clear and fill the title input
    await page.locator('#title').clear();
    await page.locator('#title').fill(newTitle);

    // Click Save
    await page.getByRole('button', { name: 'Save' }).click();

    // The updated title should appear in the management page header
    await expect(page.getByText(newTitle, { exact: false }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Clone an Event', async ({ page }) => {
    // Navigate to Conference 1 management page
    await page.goto('/event/3/manage/');
    await page.waitForLoadState('domcontentloaded');

    // Click the "Clone" button to open the clone wizard dialog
    await page.getByRole('button', { name: 'Clone' }).click();

    // Wait for the jQuery UI dialog to open - all interactions scoped to dialog
    const dialog = page.locator('.ui-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Step 1: Choose "Clone Once" repeatability
    await expect(dialog.locator('#repeatability-0')).toBeVisible();
    await dialog.locator('#repeatability-0').check();
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 2: Select what to copy - keep defaults, click Next
    await expect(dialog.locator('[name="selected_items"]').first()).toBeVisible({ timeout: 10000 });
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 3: Choose category - keep Home, click Next
    await dialog.getByRole('button', { name: 'Next' }).click({ timeout: 15000 });

    // Step 4: Final clone confirmation - click "Clone" button
    await dialog.getByRole('button', { name: 'Clone' }).click({ timeout: 15000 });

    // Should redirect to the cloned event's management page
    await page.waitForURL(/\/event\/\d+\/manage\//, { timeout: 20000 });

    // The cloned event title should reference "Conference 1"
    await expect(page.getByText(/Conference 1/i).first()).toBeVisible();
  });

  test('Delete a Newly Created Event', async ({ page }) => {
    // Create a new meeting to delete
    const deletableTitle = `Delete Me ${Date.now()}`;
    const eventId = await createMeeting(page, deletableTitle);
    expect(eventId).toBeTruthy();

    // Click the "Event actions" settings button to reveal the action dropdown
    await page.locator('[title="Event actions"]').click();
    await page.waitForTimeout(500);

    // Click Delete button (title="Delete event", text="Delete")
    await page.locator('[title="Delete event"]').click();

    // Wait for delete confirmation dialog
    await page.waitForSelector('#js-confirm-action', { timeout: 10000 });
    // Check the confirmation checkbox
    await page.locator('#js-confirm-action').check();

    // Click "Delete event" button in the dialog (scoped to avoid strict mode)
    await page.locator('.ui-dialog').getByRole('button', { name: 'Delete event' }).click();

    // Should redirect away from the event management page
    await page.waitForURL(url => !url.toString().includes(`/event/${eventId}/manage/`), { timeout: 15000 });

    // Verify the event is gone - navigating to it should show error or redirect
    const response = await page.goto(`/event/${eventId}/`);
    // Should either 404 or redirect - not the event page
    const title = await page.title();
    expect(title).not.toMatch(new RegExp(deletableTitle));
  });
});
