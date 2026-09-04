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

test.describe('Conference Registrations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('View Conference 1 Participant List', async ({ page }) => {
    // Navigate to Conference 1 participant list
    await page.goto('/event/3/registrations/participants');
    await page.waitForLoadState('domcontentloaded');

    // Participant list heading should be visible
    await expect(page.getByRole('heading', { name: 'Participant List' })).toBeVisible();
    // Should show 14 participants (from seeded data)
    await expect(page.getByText('14 participants', { exact: false })).toBeVisible();
  });

  test('View Conference Registration Menu', async ({ page }) => {
    // Navigate to Conference 1 registration menu
    await page.goto('/event/3/registrations/');
    await page.waitForLoadState('domcontentloaded');

    // Should show some registration related content
    await expect(page).not.toHaveURL(/\/login\//);
    // Registration link is in the sidebar menu
    await expect(page.getByRole('link', { name: 'Registration' })).toBeVisible();
  });

  test('View Conference Registration Management', async ({ page }) => {
    // Navigate to conference 3 registration management
    await page.goto('/event/3/manage/registration/');
    await page.waitForLoadState('domcontentloaded');

    // Should be on a registration management page
    await expect(page).not.toHaveURL(/\/login\//);
    // Management page should be accessible
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('Conference Event Timetable Page Loads', async ({ page }) => {
    // Navigate to Conference 1 timetable
    await page.goto('/event/3/timetable/');
    await page.waitForLoadState('domcontentloaded');

    // The page should load without redirect to login
    await expect(page).not.toHaveURL(/\/login\//);
    // Event title should be visible
    await expect(page.getByText('Conference 1', { exact: false })).toBeVisible();
  });
});
