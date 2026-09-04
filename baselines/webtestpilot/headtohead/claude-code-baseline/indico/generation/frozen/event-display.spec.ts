import { test, expect } from '@playwright/test';

test.describe('Event Display Pages', () => {
  test('lecture event page (event/1) displays correctly', async ({ page }) => {
    await page.goto('/event/1/');
    await expect(page).toHaveTitle(/Lecture 1.*Indico/);

    // Event title is visible in the page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Lecture 1');

    // Date visible
    expect(bodyText).toMatch(/1 Mar|March.*2025|2025/);

    // Materials download link
    await expect(page.getByRole('link', { name: 'Download material' }).or(
      page.locator('a[href*="attachments/package"]')
    )).toBeVisible();
  });

  test('lecture with survey event page (event/2) displays correctly', async ({ page }) => {
    await page.goto('/event/2/');
    await expect(page).toHaveTitle(/Lecture 2 w\/ Survey.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Lecture 2');

    // Should have a survey link
    const hasSurveyLink = await page.locator('a[href*="/surveys/"]').count() > 0;
    expect(hasSurveyLink).toBeTruthy();
  });

  test('conference event page (event/3) shows overview', async ({ page }) => {
    await page.goto('/event/3/');
    await expect(page).toHaveTitle(/Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Conference 1');
  });

  test('conference timetable display page renders (authenticated)', async ({ page }) => {
    // Login to get proper server-side rendered title
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/event/3/timetable/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Conference 1.*Timetable.*Indico/);
    // Check page content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Timetable|Conference 1/i);
  });

  test('conference contribution list page renders (authenticated)', async ({ page }) => {
    // Login to get proper server-side rendered title
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/event/3/contributions/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Conference 1.*Contribution List.*Indico/);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Contribution|Conference 1/i);
  });

  test('event page print view renders', async ({ page }) => {
    await page.goto('/event/1/?print=1');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Lecture 1');
  });

  test('authenticated user sees edit and clone options on event page', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/event/1/');
    await page.waitForLoadState('networkidle');

    // Edit Event and Clone Event links exist in the DOM (may be in a top-right area)
    const editLinks = await page.locator('a[href*="/manage/"]').count();
    expect(editLinks).toBeGreaterThan(0);

    // Check the body text contains action options
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Edit Event|Clone Event|Manage/i);
  });
});
