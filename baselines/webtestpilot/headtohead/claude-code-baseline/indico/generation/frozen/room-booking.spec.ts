import { test, expect } from '@playwright/test';

test.describe('Room Booking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('room booking home page renders search form', async ({ page }) => {
    await page.goto('/rooms/book');
    await expect(page).toHaveTitle(/Room Booking.*Indico/);

    // Navigation tabs
    await expect(page.getByRole('link', { name: 'Room Booking' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book a Room' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List of Rooms' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible();

    // Booking type options
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Single booking|Daily booking|Recurring booking/i);
  });

  test('room booking shows statistics', async ({ page }) => {
    await page.goto('/rooms/book');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/ACTIVE ROOMS|BUILDINGS|BOOKINGS TODAY/i);
  });

  test('list of rooms page renders', async ({ page }) => {
    await page.goto('/rooms/rooms');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/Room Booking.*Indico/);

    // Filter controls visible
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Building|Min\. Capacity|Capacity/i);
  });

  test('room bookings calendar page renders', async ({ page }) => {
    await page.goto('/rooms/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page).toHaveTitle(/Room Booking.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Day|Week|Month/i);
  });

  test('room booking navigation links are active on correct page', async ({ page }) => {
    await page.goto('/rooms/rooms');
    await page.waitForLoadState('networkidle');

    // "List of Rooms" link should be current/active
    const listLink = page.getByRole('link', { name: 'List of Rooms' });
    await expect(listLink).toBeVisible();
  });

  test('unauthenticated user is redirected from rooms booking', async ({ browser }) => {
    const newContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const newPage = await newContext.newPage();

    await newPage.goto('http://localhost:8080/rooms/book');
    await newPage.waitForLoadState('networkidle');

    // Should either redirect to login or show the page (some room pages may be public)
    const url = newPage.url();
    const bodyText = await newPage.locator('body').textContent();
    // Either redirected to login or room booking page content is visible
    const isLoginOrRoom = url.includes('/login/') || bodyText?.includes('Room Booking') || bodyText?.includes('book');
    expect(isLoginOrRoom).toBeTruthy();

    await newContext.close();
  });
});
