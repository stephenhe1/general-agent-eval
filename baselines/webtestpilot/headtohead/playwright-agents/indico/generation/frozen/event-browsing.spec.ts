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

test.describe('Event Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Home Page Loads with Event List', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // "Main categories" heading should be visible (root category view)
    await expect(page.getByRole('heading', { name: 'Main categories' })).toBeVisible();
    // Create event button should be visible for admin in the nav
    await expect(page.getByRole('button', { name: 'Create event' }).first()).toBeVisible();
  });

  test('Browse to Conference Event Detail', async ({ page }) => {
    // Navigate to Conference 1
    await page.goto('/event/3/');
    await page.waitForLoadState('domcontentloaded');

    // Page title should contain "Conference 1"
    await expect(page).toHaveTitle(/Conference 1/);
    // Description text should be visible
    await expect(page.getByText('Pellentesque', { exact: false })).toBeVisible();
    // Location should be shown (use first to avoid strict mode violation)
    await expect(page.getByText('Conference Venue', { exact: false }).first()).toBeVisible();
  });

  test('Browse to Meeting Event Detail', async ({ page }) => {
    // Navigate to Weekly Software Architecture Sync (event 5, avoids state contamination from edit tests)
    await page.goto('/event/5/');
    await page.waitForLoadState('domcontentloaded');

    // Page title should contain the event name
    await expect(page).toHaveTitle(/Weekly Software Architecture Sync/);
    // Timetable link should be visible in sidebar
    await expect(page.getByRole('link', { name: /timetable/i })).toBeVisible();
  });

  test('Browse to Lecture Event Detail', async ({ page }) => {
    // Navigate to Lecture 1
    await page.goto('/event/1/');
    await page.waitForLoadState('domcontentloaded');

    // Page title should contain "Lecture 1"
    await expect(page).toHaveTitle(/Lecture 1/);
    // Event title heading should be visible
    await expect(page.getByRole('heading', { name: 'Lecture 1' })).toBeVisible();
  });

  test('Browse to IC-AIT 2026 Conference', async ({ page }) => {
    // Navigate to IC-AIT 2026 (event 6)
    await page.goto('/event/6/');
    await page.waitForLoadState('domcontentloaded');

    // Page title should contain the conference name
    await expect(page).toHaveTitle(/IC-AIT 2026/);
    // Timetable link should be visible in conference navigation
    await expect(page.getByRole('link', { name: 'Timetable' })).toBeVisible();
  });
});
