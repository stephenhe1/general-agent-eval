import { test, expect } from '@playwright/test';

test.describe('Survey', () => {
  test('survey display page renders for event/2 (authenticated)', async ({ page }) => {
    // Login for proper title rendering
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/event/2/surveys/1');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Lecture 2 w\/ Survey.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Survey|Lecture Survey/i);
  });

  test('survey page shows questions or survey form', async ({ page }) => {
    await page.goto('/event/2/surveys/1');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    // Should show survey content (title and/or questions)
    expect(bodyText).toMatch(/Lecture Survey|Curabitur|survey/i);
  });

  test('authenticated user can access survey management', async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');

    await page.goto('/event/2/manage/surveys/');
    await expect(page).toHaveTitle(/Management.*Surveys.*Lecture 2 w\/ Survey.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Surveys/i);
  });

  test('survey linked from event page', async ({ page }) => {
    await page.goto('/event/2/');
    await page.waitForLoadState('networkidle');

    // Survey link should be visible on the event page
    const surveyLink = page.locator('a[href*="/surveys/"]');
    await expect(surveyLink.first()).toBeVisible();
  });
});
