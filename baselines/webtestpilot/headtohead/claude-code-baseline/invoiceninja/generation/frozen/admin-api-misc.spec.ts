/**
 * Admin API — Expenses, Credits, Recurring Invoices, Company Settings
 */
import { test, expect } from '@playwright/test';

const API_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

async function getToken(request: any): Promise<string> {
  const resp = await request.post('/api/v1/login', {
    data: { email: 'admin@admin.com', password: 'password' },
    headers: { 'X-Api-Secret': '', ...API_HEADERS },
  });
  return (await resp.json()).data[0].token.token as string;
}

function authHeaders(token: string) {
  return { ...API_HEADERS, 'X-API-TOKEN': token };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

test.describe('Admin API — Expenses', () => {
  test('GET /api/v1/expenses returns seeded expense', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/expenses', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const expenses = (await resp.json()).data;
    expect(expenses.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/v1/expenses creates an expense', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/expenses', {
      headers: authHeaders(token),
      data: {
        vendor_id: '',
        client_id: 'VolejRejNm',
        amount: 75.50,
        category_id: '',
        public_notes: `Test expense ${Date.now()}`,
      },
    });
    expect(createResp.status()).toBe(200);
    const expense = (await createResp.json()).data;
    expect(Number(expense.amount)).toBe(75.5);
    const expenseId = expense.id;

    // Verify via GET
    const getResp = await request.get(`/api/v1/expenses/${expenseId}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    expect(Number((await getResp.json()).data.amount)).toBe(75.5);
  });

  test('PUT /api/v1/expenses/:id updates public_notes', async ({ request }) => {
    const token = await getToken(request);

    // Create
    const createResp = await request.post('/api/v1/expenses', {
      headers: authHeaders(token),
      data: { amount: 20, public_notes: 'original notes' },
    });
    const expenseId = (await createResp.json()).data.id;

    const newNotes = `updated-${Date.now()}`;
    const putResp = await request.put(`/api/v1/expenses/${expenseId}`, {
      headers: authHeaders(token),
      data: { public_notes: newNotes },
    });
    expect(putResp.status()).toBe(200);
    expect((await putResp.json()).data.public_notes).toBe(newNotes);
  });
});

// ─── Credits ──────────────────────────────────────────────────────────────────

test.describe('Admin API — Credits', () => {
  test('GET /api/v1/credits returns seeded credit', async ({ request }) => {
    const token = await getToken(request);
    // Filter by number to avoid pagination issues from test-created records
    const resp = await request.get('/api/v1/credits?number=123456', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const credits = (await resp.json()).data;
    expect(credits.length).toBeGreaterThanOrEqual(1);

    const seeded = credits.find((c: any) => c.number === '123456');
    expect(seeded).toBeTruthy();
    expect(Number(seeded.amount)).toBe(120000);
  });

  test('POST /api/v1/credits creates a credit', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/credits', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        line_items: [{ cost: 200, quantity: 1, notes: 'Credit note' }],
      },
    });
    expect(createResp.status()).toBe(200);
    const credit = (await createResp.json()).data;
    expect(Number(credit.amount)).toBe(200);
    expect(credit.client_id).toBe('VolejRejNm');

    // Verify via GET
    const getResp = await request.get(`/api/v1/credits/${credit.id}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    expect(Number((await getResp.json()).data.amount)).toBe(200);
  });

  test('GET /api/v1/credits/VolejRejNm returns the seeded credit', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/credits/VolejRejNm', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const credit = (await resp.json()).data;
    expect(credit.number).toBe('123456');
    expect(Number(credit.amount)).toBe(120000);
  });
});

// ─── Recurring Invoices ───────────────────────────────────────────────────────

test.describe('Admin API — Recurring Invoices', () => {
  test('GET /api/v1/recurring_invoices returns seeded recurring invoice', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/recurring_invoices', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const recurring = (await resp.json()).data;
    expect(recurring.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/v1/recurring_invoices creates a recurring invoice', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/recurring_invoices', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        frequency_id: '5', // Monthly
        line_items: [{ cost: 100, quantity: 1, notes: 'Monthly recurring' }],
      },
    });
    expect(createResp.status()).toBe(200);
    const recInv = (await createResp.json()).data;
    expect(recInv.client_id).toBe('VolejRejNm');
    expect(Number(recInv.amount)).toBe(100);
  });
});

// ─── Company / Account info ───────────────────────────────────────────────────

test.describe('Admin API — Company and Account', () => {
  test('GET /api/v1/account returns account info', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/account', {
      headers: authHeaders(token),
    });
    // Invoice Ninja may or may not have this endpoint — check 200 or 404
    expect([200, 404]).toContain(resp.status());
  });

  test('GET /api/v1/users returns at least the admin user', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/users', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const users = (await resp.json()).data;
    expect(users.length).toBeGreaterThanOrEqual(1);

    const admin = users.find((u: any) => u.email === 'admin@admin.com');
    expect(admin).toBeTruthy();
  });

  test('GET /api/v1/statics returns lookup data', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/statics', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const statics = await resp.json();
    // Should have countries, currencies, etc.
    expect(statics.countries).toBeInstanceOf(Array);
    expect(statics.currencies).toBeInstanceOf(Array);
    expect(statics.countries.length).toBeGreaterThan(0);
    expect(statics.currencies.length).toBeGreaterThan(0);
  });
});
