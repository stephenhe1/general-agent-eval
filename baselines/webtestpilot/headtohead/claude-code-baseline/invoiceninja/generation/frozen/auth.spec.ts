/**
 * Authentication tests — Invoice Ninja
 *
 * Covers:
 *  - Admin API authentication (POST /api/v1/login)
 *  - Client portal login / logout flow
 *  - Client portal password-reset page renders
 *  - Protected API routes require a token
 */
import { test, expect } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

async function getApiToken(request: any): Promise<string> {
  const resp = await request.post('/api/v1/login', {
    data: { email: 'admin@admin.com', password: 'password' },
    headers: { 'X-Api-Secret': '', 'X-Requested-With': 'XMLHttpRequest' },
  });
  const body = await resp.json();
  return body.data[0]?.token?.token as string;
}

// ─── Admin API auth ──────────────────────────────────────────────────────────

test.describe('Admin API authentication', () => {
  test('valid credentials return a token and company data', async ({ request }) => {
    const resp = await request.post('/api/v1/login', {
      data: { email: 'admin@admin.com', password: 'password' },
      headers: { 'X-Api-Secret': '', 'X-Requested-With': 'XMLHttpRequest' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThan(0);

    const record = body.data[0];
    // Token must exist and be a non-empty string
    expect(typeof record.token?.token).toBe('string');
    expect(record.token.token.length).toBeGreaterThan(0);

    // Company key must be present
    expect(record.company?.company_key).toBeTruthy();

    // User email must match
    expect(record.user?.email).toBe('admin@admin.com');
  });

  test('invalid credentials return an auth error', async ({ request }) => {
    const resp = await request.post('/api/v1/login', {
      data: { email: 'admin@admin.com', password: 'wrong_password' },
      headers: { 'X-Api-Secret': '', 'X-Requested-With': 'XMLHttpRequest' },
    });

    // Invoice Ninja returns 401 Unauthorized for wrong credentials
    expect([401, 422]).toContain(resp.status());
    // Must not return 200
    expect(resp.status()).not.toBe(200);
  });

  test('missing email returns a 422 error', async ({ request }) => {
    const resp = await request.post('/api/v1/login', {
      data: { password: 'password' },
      headers: { 'X-Api-Secret': '', 'X-Requested-With': 'XMLHttpRequest' },
    });

    expect(resp.status()).toBe(422);
  });

  test('GET /api/v1/clients without token returns an auth error', async ({ request }) => {
    const resp = await request.get('/api/v1/clients', {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    // Invoice Ninja returns 401 or 403 for unauthenticated API requests
    expect([401, 403]).toContain(resp.status());
    expect(resp.status()).not.toBe(200);
  });

  test('GET /api/v1/clients with valid token returns 200', async ({ request }) => {
    const token = await getApiToken(request);
    const resp = await request.get('/api/v1/clients', {
      headers: {
        'X-API-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeInstanceOf(Array);
  });
});

// ─── Client portal login ─────────────────────────────────────────────────────

// The /client/login route has a strict rate limit (15 requests/minute).
// To avoid hitting it, the request-based tests in this group share a single
// GET to /client/login (for the CSRF token) via beforeAll.
test.describe('Client portal login', () => {
  let sharedCsrfToken: string;

  // Fetch the CSRF token once for all request-based tests in this group.
  test.beforeAll(async ({ request }) => {
    const resp = await request.get('/client/login');
    const html = await resp.text();
    const m = html.match(/name="_token"\s+value="([^"]+)"/);
    sharedCsrfToken = m ? m[1] : '';
  });

  test('login page renders with email and password fields', async ({ page }) => {
    await page.goto('/client/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    expect(await page.title()).toContain('Login');
  });

  test('wrong credentials return an error response', async ({ request }) => {
    // Fetch a fresh CSRF token in this request context (the beforeAll token is
    // from a different request context and is not valid here).
    const getResp = await request.get('/client/login');
    const html = await getResp.text();
    const m = html.match(/name="_token"\s+value="([^"]+)"/);
    const token = m ? m[1] : sharedCsrfToken;
    expect(token.length).toBeGreaterThan(0);

    const postResp = await request.post('/client/login', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `_token=${encodeURIComponent(token)}&email=email%40example.com&password=wrong_password`,
    });
    expect([200, 302]).toContain(postResp.status());
    const body = await postResp.text();
    expect(body).toContain('credentials do not match');
  });

  test('correct credentials redirect to invoices', async ({ request }) => {
    // Re-fetch a fresh CSRF token (the previous POST may have rotated it).
    const getResp = await request.get('/client/login');
    const html = await getResp.text();
    const m = html.match(/name="_token"\s+value="([^"]+)"/);
    const token = m ? m[1] : sharedCsrfToken;

    const postResp = await request.post('/client/login', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: `_token=${encodeURIComponent(token)}&email=email%40example.com&password=Password1%21`,
    });
    expect([200, 302]).toContain(postResp.status());
    expect(postResp.url()).toContain('/client/invoices');
  });

  test('protected routes redirect unauthenticated users to login', async ({ request }) => {
    const protectedRoutes = ['/client/invoices', '/client/payments'];
    for (const route of protectedRoutes) {
      const resp = await request.get(route);
      expect(resp.url()).toContain('/client/login');
    }
  });

  test('password reset page renders', async ({ page }) => {
    await page.goto('/client/password/reset');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('body')).toContainText('Password');
  });
});
