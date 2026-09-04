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

test.describe('Meeting Timetable', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('View Meeting Timetable Page', async ({ page }) => {
    // Use event 5 (Weekly Software Architecture Sync) - unaffected by other tests
    await page.goto('/event/5/timetable/');
    await page.waitForLoadState('domcontentloaded');

    // Timetable page should load without redirect
    await expect(page).not.toHaveURL(/\/login\//);
    // Event title heading should be visible
    await expect(page.getByRole('heading', { name: 'Weekly Software Architecture Sync' })).toBeVisible();
  });

  test('Meeting Timetable Management Page Loads', async ({ page }) => {
    // Use event 5 (Weekly Software Architecture Sync) - unaffected by other tests
    await page.goto('/event/5/manage/timetable/');
    await page.waitForLoadState('domcontentloaded');

    // Management timetable page should load without redirect
    await expect(page).not.toHaveURL(/\/login\//);
    // Event name should appear in the management banner
    await expect(page.getByText('Weekly Software Architecture Sync', { exact: false }).first()).toBeVisible();
    // The timetable element should be present in the page
    await expect(page.locator('#timetable')).toBeAttached();
  });

  test('Meeting Sidebar Shows Timetable Link', async ({ page }) => {
    // Navigate to event 4 (Meeting 1) detail page
    await page.goto('/event/4/');
    await page.waitForLoadState('domcontentloaded');

    // The timetable link should be visible in the event sidebar/menu
    await expect(page.getByRole('link', { name: /timetable/i })).toBeVisible();
  });

  test('PhD Meeting Timetable Accessible', async ({ page }) => {
    // Navigate to PhD Research Group Monthly Meeting (event 7) timetable
    await page.goto('/event/7/timetable/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).not.toHaveURL(/\/login\//);
    await expect(page.getByText('PhD Research Group Monthly Meeting', { exact: false })).toBeVisible();
  });
});
