import { test, expect } from '@playwright/test';

test.describe('Author Create Page (/authors/create)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/authors/create');
    await page.waitForLoadState('networkidle');
  });

  test('create form loads with correct fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Author' })).toBeVisible();

    // Required fields
    await expect(page.getByLabel('Name*')).toBeVisible();
    await expect(page.getByLabel('Email*')).toBeVisible();

    // Posts relationship field (combobox)
    await expect(page.getByRole('combobox', { name: 'Posts' })).toBeVisible();

    // Verified checkbox
    await expect(page.getByLabel('Verified')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();
  });

  test('submitting empty form shows validation errors for required fields', async ({ page }) => {
    // Click Create with empty form
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(500);

    // Keystone shows "Name must not be empty" for required empty fields
    await expect(page.getByText(/must not be empty/i)).toBeVisible();

    // Should still be on create page
    await expect(page).toHaveURL(/\/authors\/create/);
  });

  test('happy path: create a new author and verify it appears in list', async ({ page }) => {
    const testName = `Test Author ${Date.now()}`;
    const testEmail = `test${Date.now()}@example.com`;

    // Fill in required fields
    await page.getByLabel('Name*').fill(testName);
    await page.getByLabel('Email*').fill(testEmail);

    // Submit - CUID IDs are 25 chars long, "create" is 6 chars, use length to distinguish
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/authors\/[a-z0-9]{20,}$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Should redirect to the new author's detail page
    await expect(page).toHaveURL(/\/authors\/[a-z0-9]{20,}$/);

    // The new author's name should be displayed as heading
    await expect(page.getByRole('heading', { name: testName })).toBeVisible();

    // Name field should have the correct value
    await expect(page.getByLabel('Name*')).toHaveValue(testName);

    // Verify the author appears in the list via search
    // (Keystone uses virtual scrolling — only ~16 rows in DOM at a time; search filters to 1 result)
    await page.goto('/authors');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByRole('searchbox', { name: 'Search' });
    await searchInput.fill(testName);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test('verified checkbox is checked by default', async ({ page }) => {
    const checkbox = page.getByLabel('Verified');
    await expect(checkbox).toBeChecked();
  });

  test('creates author with verified=false when unchecked', async ({ page }) => {
    const testName = `Unverified Author ${Date.now()}`;
    const testEmail = `unverified${Date.now()}@example.com`;

    await page.getByLabel('Name*').fill(testName);
    await page.getByLabel('Email*').fill(testEmail);

    // Uncheck verified
    const checkbox = page.getByLabel('Verified');
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    // Submit
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/authors\/[a-z0-9]{20,}$/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Should land on detail page
    await expect(page).toHaveURL(/\/authors\/[a-z0-9]{20,}$/);

    // Verified checkbox should be unchecked in detail
    const detailCheckbox = page.getByLabel('Verified');
    await expect(detailCheckbox).not.toBeChecked();
  });

  test('breadcrumb Authors link leads back to authors list', async ({ page }) => {
    // Breadcrumb "Authors" link (first occurrence) navigates back to /authors
    await page.getByRole('link', { name: 'Authors' }).first().click();
    await page.waitForLoadState('networkidle');
    // URL may include column params from previous navigation - just check it's the authors list
    await expect(page).toHaveURL(/\/authors/);
    await expect(page.getByRole('heading', { name: 'Authors' })).toBeVisible();
  });

  test('submitting duplicate email shows an error', async ({ page }) => {
    // Use a known existing email from seeded data
    await page.getByLabel('Name*').fill('Duplicate Author');
    await page.getByLabel('Email*').fill('arthur.cd@email.com');

    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);

    // Keystone shows "Unable to create author" or "Prisma error" for uniqueness violation
    // Use .first() to avoid strict mode violation when multiple elements match the pattern
    await expect(page.getByText(/Unable to create|Prisma error/i).first()).toBeVisible();

    // Should remain on create page
    await expect(page).toHaveURL(/\/authors\/create/);
  });
});
