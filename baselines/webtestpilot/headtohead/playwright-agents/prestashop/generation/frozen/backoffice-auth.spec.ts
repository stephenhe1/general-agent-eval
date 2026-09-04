import { test, expect } from '@playwright/test';

const BO_URL = 'http://localhost:8083/webtestpilot/';
const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'admin12345';

async function loginToBackOffice(page: any) {
  await page.goto(BO_URL);
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Log in/i }).click();
  await page.waitForURL(/controller=AdminDashboard/);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test.describe('BO-AUTH — Authentication', () => {
  test('BO-AUTH-01 — Successful admin login', async ({ page }) => {
    await page.goto(BO_URL);
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/controller=AdminDashboard/);
    await expect(page).toHaveTitle(/Dashboard.*PrestaShop/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

    const sidebar = page.locator('#nav-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Orders').first()).toBeVisible();
    await expect(sidebar.getByText('Catalog').first()).toBeVisible();
    await expect(sidebar.getByText('Customers').first()).toBeVisible();
  });

  test('BO-AUTH-02 — Login with wrong password is rejected', async ({ page }) => {
    await page.goto(BO_URL);
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.getByLabel('Password').fill('wrong_password_123');
    await page.getByRole('button', { name: /Log in/i }).click();

    await expect(page).toHaveURL(/controller=AdminLogin/);
    await expect(page.locator('#error')).toBeVisible();
    // Must NOT be on the dashboard
    await expect(page).not.toHaveURL(/controller=AdminDashboard/);
  });

  test('BO-AUTH-03 — Logout redirects to login page', async ({ page }) => {
    await loginToBackOffice(page);

    // Click the user avatar / dropdown in the top bar then sign out
    await page.locator('a.employee_name').click();
    await page.locator('#header_logout').click();

    await expect(page).toHaveURL(/controller=AdminLogin/);

    // Attempting to navigate to dashboard must bring us back to login
    await page.goto(`${BO_URL}index.php?controller=AdminDashboard`);
    await expect(page).toHaveURL(/controller=AdminLogin/);
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

test.describe('BO-DASH — Dashboard', () => {
  test('BO-DASH-01 — Dashboard renders key widgets', async ({ page }) => {
    await loginToBackOffice(page);

    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();

    const pendingWidget = page.locator('#dash_pending');
    await expect(pendingWidget).toBeVisible();
    await expect(pendingWidget).toContainText('Currently Pending');

    const recentOrders = page.locator('#dash_recent_orders');
    await expect(recentOrders).toBeVisible();

    const bestSellers = page.locator('#dash_best_sellers');
    await expect(bestSellers).toBeVisible();

    const customers = page.locator('#dash_customers');
    await expect(customers).toBeVisible();
    await expect(customers).toContainText('New Customers');

    const notifications = page.locator('#dash_notifications');
    await expect(notifications).toBeVisible();
    await expect(notifications).toContainText('New Messages');
  });

  test('BO-DASH-02 — Global header search bar accepts input', async ({ page }) => {
    await loginToBackOffice(page);

    const searchInput = page.locator('#bo_query');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('t-shirt');
    await expect(searchInput).toHaveValue('t-shirt');
    await searchInput.press('Enter');

    // The search results page loads without a 500 error
    await expect(page).not.toHaveTitle(/Error/i);
    await page.waitForLoadState('domcontentloaded');
  });
});
