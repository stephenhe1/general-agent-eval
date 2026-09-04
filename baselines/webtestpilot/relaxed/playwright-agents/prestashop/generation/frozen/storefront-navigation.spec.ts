import { test, expect } from '@playwright/test';

// TC-53 Main navigation menu items link to correct categories
test('TC-53 main nav links navigate to correct category pages', async ({ page }) => {
  await page.goto('/');

  // Click "Clothes"
  await page.getByRole('link', { name: /^Clothes$/ }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/3-clothes/);
  await expect(page.getByRole('heading', { name: /Clothes/i })).toBeVisible();

  // Go back and click "Accessories"
  await page.goto('/');
  await page.getByRole('link', { name: /^Accessories$/ }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/6-accessories/);
  await expect(page.getByRole('heading', { name: 'Accessories', exact: true })).toBeVisible();

  // Go back and click "Art"
  await page.goto('/');
  await page.getByRole('link', { name: /^Art$/ }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/9-art/);
  await expect(page.getByRole('heading', { name: /Art/i })).toBeVisible();
});

// TC-54 Logo click returns to homepage
test('TC-54 clicking site logo from a category page navigates to homepage', async ({ page }) => {
  await page.goto('/4-men');
  await page.waitForLoadState('domcontentloaded');

  // Click the site logo
  const logo = page.locator('#_desktop_logo a, .logo, header a[href="/"], header a:has(img[alt*="logo"])').first();
  await logo.click();
  await page.waitForLoadState('domcontentloaded');

  // Should be on homepage
  const url = page.url();
  // The URL should be the base URL or very close to it (possibly /?id_lang=1 etc.)
  expect(url).toMatch(/localhost:8083\/?(\?.*)?$/);
});

// TC-55 Footer link to Legal Notice is functional
test('TC-55 clicking Legal Notice in footer navigates to legal notice CMS page', async ({ page }) => {
  await page.goto('/');

  // Click "Legal Notice" in the footer
  const legalNoticeLink = page.locator('footer').getByRole('link', { name: /Legal Notice/i });
  await legalNoticeLink.click();
  await page.waitForLoadState('domcontentloaded');

  // Should navigate to legal notice page
  await expect(page).toHaveURL(/\/content\/2-legal-notice/);

  // Page heading reads "Legal Notice"
  await expect(page.getByRole('heading', { name: /Legal Notice/i })).toBeVisible();
});
