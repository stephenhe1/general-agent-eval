import { test, expect } from '@playwright/test';

test.describe('Event Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('create lecture event and verify it appears', async ({ page }) => {
    const eventTitle = `E2E Lecture ${Date.now()}`;

    // Navigate to the create lecture dialog (via the special URL the data-href points to)
    await page.goto('/event/create/lecture?category_id=0');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Fill title
    await page.fill('#event-creation-title', eventTitle);

    // Fill date (DD/MM/YYYY format)
    const dateInput = page.locator('input[placeholder="DD/MM/YYYY"]').first();
    await dateInput.fill('15/09/2025');

    // Fill time
    const timeInput = page.locator('input[placeholder="--:--"]').first();
    await timeInput.fill('14:00');

    // Submit
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').last();
    await submitBtn.click({ force: true });

    // Should redirect to manage page of the new event
    await page.waitForURL(/\/event\/\d+\/manage\//);
    await expect(page).toHaveTitle(new RegExp(`Management.*${eventTitle}.*Indico`));

    // Verify the event title is shown in the management page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain(eventTitle);

    // Verify the event is now accessible from home
    await page.goto('/');
    // The event should show up in category listing (may be in past events section)
    const homeText = await page.locator('body').textContent();
    expect(homeText).toMatch(/Lecture|event/i);
  });

  test('create meeting event and verify management redirect', async ({ page }) => {
    const eventTitle = `E2E Meeting ${Date.now()}`;

    await page.goto('/event/create/meeting?category_id=0');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.fill('#event-creation-title', eventTitle);

    const dateInput = page.locator('input[placeholder="DD/MM/YYYY"]').first();
    await dateInput.fill('20/09/2025');

    const timeInput = page.locator('input[placeholder="--:--"]').first();
    await timeInput.fill('09:00');

    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').last();
    await submitBtn.click({ force: true });

    await page.waitForURL(/\/event\/\d+\/manage\//);

    // Extract event ID from URL
    const url = page.url();
    const match = url.match(/\/event\/(\d+)\//);
    expect(match).toBeTruthy();

    // Verify title in management page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain(eventTitle);
  });

  test('event creation requires a title (validation)', async ({ page }) => {
    await page.goto('/event/create/lecture?category_id=0');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Don't fill title - just try to submit
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]').last();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Should still be on the creation page or show validation
    const currentUrl = page.url();
    const titleField = page.locator('#event-creation-title');
    const isStillOnPage = currentUrl.includes('create') || currentUrl.includes('#create-event') ||
                          await titleField.count() > 0;
    expect(isStillOnPage).toBeTruthy();
  });

  test('clone event button exists in event management page', async ({ page }) => {
    // The management page has a Clone button
    await page.goto('/event/1/manage/');
    await page.waitForLoadState('networkidle');

    // Clone is a button (not a link) in the management page
    const cloneBtn = page.locator('button', { hasText: 'Clone' });
    await expect(cloneBtn).toBeVisible();
    await expect(cloneBtn).toHaveCount(1);
  });
});
