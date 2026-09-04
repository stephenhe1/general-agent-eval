import { test, expect } from '@playwright/test';

test.describe('Conference Management (event/3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/');
    await page.fill('#identifier', 'admin@admin.com');
    await page.fill('#password', 'webtestpilot');
    await page.click('button.login-form-button');
    await page.waitForLoadState('networkidle');
  });

  test('conference management settings page renders', async ({ page }) => {
    await page.goto('/event/3/manage/');
    await expect(page).toHaveTitle(/Management.*Settings.*Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Conference 1');
  });

  test('conference has more sidebar items than lecture', async ({ page }) => {
    await page.goto('/event/3/manage/');

    // Conference-specific items visible in sidebar
    await expect(page.getByRole('link', { name: 'Timetable' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contributions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Programme' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sessions' })).toBeVisible();
    // Call for Abstracts may be in a collapsed "Workflows" section - verify link exists in DOM
    await expect(page.locator('a[href*="/abstracts/"]')).toHaveCount(1);
  });

  test('conference timetable management page renders', async ({ page }) => {
    await page.goto('/event/3/manage/timetable/');
    await expect(page).toHaveTitle(/Management.*Timetable.*Conference 1.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('conference contributions management page renders', async ({ page }) => {
    await page.goto('/event/3/manage/contributions/');
    await expect(page).toHaveTitle(/Management.*Contributions.*Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Contributions|contribution/i);
  });

  test('conference programme (tracks) page renders', async ({ page }) => {
    await page.goto('/event/3/manage/tracks/');
    await expect(page).toHaveTitle(/Management.*Programme.*Conference 1.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('conference registration management page renders', async ({ page }) => {
    await page.goto('/event/3/manage/registration/');
    await expect(page).toHaveTitle(/Management.*Registration.*Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Registration/i);
  });

  test('conference sessions management page renders', async ({ page }) => {
    await page.goto('/event/3/manage/sessions/');
    await expect(page).toHaveTitle(/Management.*Sessions.*Conference 1.*Indico/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('conference abstracts (call for abstracts) page renders', async ({ page }) => {
    await page.goto('/event/3/manage/abstracts/');
    await expect(page).toHaveTitle(/Management.*Call for Abstracts.*Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Abstract|Call for Abstracts/i);
  });

  test('conference peer reviewing (papers) page renders', async ({ page }) => {
    await page.goto('/event/3/manage/papers/');
    await expect(page).toHaveTitle(/Management.*Peer Reviewing.*Conference 1.*Indico/);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Peer Reviewing|Papers|Abstract/i);
  });
});
