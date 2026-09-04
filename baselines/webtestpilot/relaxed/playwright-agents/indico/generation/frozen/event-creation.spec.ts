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

async function openCreateEventDialog(page: any, type: 'lecture' | 'meeting' | 'conference') {
  // Navigate to the category management page
  await page.goto('/category/0/manage/');
  await page.waitForLoadState('domcontentloaded');

  // Use JS click to bypass CSS visibility — both elements are inside hidden dropdowns
  await page.evaluate((t) => {
    const el = document.getElementById(`create-${t}`) as HTMLElement | null;
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, type);

  // Wait for the AJAX dialog to open
  await page.waitForSelector('#event-creation-title', { timeout: 15000 });
}

test.describe('Event Creation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Create a New Lecture', async ({ page }) => {
    const uniqueTitle = `Test Lecture ${Date.now()}`;

    // Open create lecture dialog via category management toolbar
    await openCreateEventDialog(page, 'lecture');

    // Fill in the event title
    await page.locator('#event-creation-title').fill(uniqueTitle);

    // Submit the creation form (click the "Create event" submit button in the form)
    await page.locator('input[type="submit"][value="Create event"]').click();

    // Should be redirected to the new event's management page
    await page.waitForURL(/\/event\/\d+\/manage\//, { timeout: 20000 });

    // New event title should appear on the management page
    await expect(page.getByText(uniqueTitle, { exact: false }).first()).toBeVisible();
  });

  test('Create a New Meeting', async ({ page }) => {
    const uniqueTitle = `Test Meeting ${Date.now()}`;

    // Open create meeting dialog via category management toolbar
    await openCreateEventDialog(page, 'meeting');

    // Fill in the event title
    await page.locator('#event-creation-title').fill(uniqueTitle);

    // Submit the creation form
    await page.locator('input[type="submit"][value="Create event"]').click();

    // Should be redirected to the new event's management page
    await page.waitForURL(/\/event\/\d+\/manage\//, { timeout: 20000 });

    // New event title should appear
    await expect(page.getByText(uniqueTitle, { exact: false }).first()).toBeVisible();
  });

  test('Create a New Conference', async ({ page }) => {
    const uniqueTitle = `Test Conference ${Date.now()}`;

    // Open create conference dialog via category management toolbar
    await openCreateEventDialog(page, 'conference');

    // Fill in the event title
    await page.locator('#event-creation-title').fill(uniqueTitle);

    // Submit the creation form
    await page.locator('input[type="submit"][value="Create event"]').click();

    // Should be redirected to the new event's management page
    await page.waitForURL(/\/event\/\d+\/manage\//, { timeout: 20000 });

    // New event title should appear
    await expect(page.getByText(uniqueTitle, { exact: false }).first()).toBeVisible();
  });
});
