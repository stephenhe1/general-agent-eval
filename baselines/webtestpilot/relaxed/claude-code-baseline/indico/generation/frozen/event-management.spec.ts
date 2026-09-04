import { test, expect } from '@playwright/test';

test.describe('Event Management - Lecture (event/1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('event management settings page renders with event info', async ({ page }) => {
    await page.goto('/event/1/manage/');
    await expect(page).toHaveTitle(/Management.*Settings.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Lecture 1');
    // Settings sidebar item
    expect(bodyText).toMatch(/Settings|Protection|Privacy/);
  });

  test('event management sidebar navigation works', async ({ page }) => {
    await page.goto('/event/1/manage/');

    // Check all sidebar links are visible
    await expect(page.getByRole('link', { name: 'Protection' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Materials' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Participant Roles' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Participants' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reminders' })).toBeVisible();
  });

  test('event protection page renders access controls', async ({ page }) => {
    await page.goto('/event/1/manage/protection');
    await expect(page).toHaveTitle(/Management.*Protection.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Protection|Permissions|Category Manager/i);
  });

  test('event privacy page renders privacy settings', async ({ page }) => {
    await page.goto('/event/1/manage/privacy');
    await expect(page).toHaveTitle(/Management.*Privacy.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Privacy|Data controller/i);
  });

  test('event materials page renders attachment management', async ({ page }) => {
    await page.goto('/event/1/manage/attachments/');
    await expect(page).toHaveTitle(/Management.*Materials.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Materials|Add materials/i);
  });

  test('event participant roles page renders', async ({ page }) => {
    await page.goto('/event/1/manage/persons/');
    await expect(page).toHaveTitle(/Management.*Participant Roles.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Participant Roles|Send email|invitation/i);
  });

  test('event participants page renders', async ({ page }) => {
    await page.goto('/event/1/manage/participants/');
    await expect(page).toHaveTitle(/Management.*Participants.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Participants|registration/i);
  });

  test('event reminders page renders with add reminder option', async ({ page }) => {
    await page.goto('/event/1/manage/reminders/');
    await expect(page).toHaveTitle(/Management.*Reminders.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Reminders|Add Reminder/i);
  });

  test('event surveys management page renders', async ({ page }) => {
    await page.goto('/event/2/manage/surveys/');
    await expect(page).toHaveTitle(/Management.*Surveys.*Lecture 2 w\/ Survey.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Surveys/i);
  });

  test('event logs page renders', async ({ page }) => {
    await page.goto('/event/1/manage/logs/');
    await expect(page).toHaveTitle(/Management.*Logs.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Logs|Show/i);
  });

  test('event layout page renders', async ({ page }) => {
    await page.goto('/event/1/manage/layout/');
    await expect(page).toHaveTitle(/Management.*Layout.*Lecture 1.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('event features page renders', async ({ page }) => {
    await page.goto('/event/1/manage/features/');
    await expect(page).toHaveTitle(/Management.*Features.*Lecture 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Features/i);
  });

  test('switch to display view link goes back to event page', async ({ page }) => {
    await page.goto('/event/1/manage/');
    await page.getByRole('link', { name: 'Switch to display view' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/event\/1\/$/);
    await expect(page).toHaveTitle(/Lecture 1.*Indico/);
  });
});
