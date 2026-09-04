/**
 * Admin API — Quotes CRUD
 *
 * Quote status IDs: 1=Draft 2=Sent 3=Approved 4=Expired
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

test.describe('Admin API — Quotes', () => {
  test('GET /api/v1/quotes returns seeded quotes', async ({ request }) => {
    const token = await getToken(request);
    // Filter by number to avoid pagination issues from test-created records
    const resp = await request.get('/api/v1/quotes?number=123456', {
      headers: authHeaders(token),
    });

    expect(resp.status()).toBe(200);
    const quotes = (await resp.json()).data;
    expect(quotes.length).toBeGreaterThanOrEqual(1);

    const seeded = quotes.find((q: any) => q.number === '123456');
    expect(seeded).toBeTruthy();
  });

  test('POST /api/v1/quotes creates a quote and it appears in GET list', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/quotes', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        line_items: [{ cost: 300, quantity: 1, notes: 'Quote item' }],
      },
    });
    expect(createResp.status()).toBe(200);
    const created = (await createResp.json()).data;
    expect(created.client_id).toBe('VolejRejNm');
    expect(Number(created.amount)).toBe(300);
    const quoteId = created.id;

    // Verify via GET
    const getResp = await request.get(`/api/v1/quotes/${quoteId}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    expect((await getResp.json()).data.id).toBe(quoteId);
  });

  test('PUT /api/v1/quotes/:id updates the quote', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/quotes', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 150, quantity: 1 }] },
    });
    const quoteId = (await createResp.json()).data.id;

    const newPoNumber = `QP-${Date.now()}`;
    const putResp = await request.put(`/api/v1/quotes/${quoteId}`, {
      headers: authHeaders(token),
      data: { po_number: newPoNumber },
    });
    expect(putResp.status()).toBe(200);
    expect((await putResp.json()).data.po_number).toBe(newPoNumber);
  });

  test('mark_sent action changes quote status from Draft to Sent', async ({ request }) => {
    const token = await getToken(request);

    // Create draft quote
    const createResp = await request.post('/api/v1/quotes', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 100, quantity: 1 }] },
    });
    const quote = (await createResp.json()).data;
    const quoteId = quote.id;
    expect(Number(quote.status_id)).toBe(1); // Draft

    // Mark sent via bulk action
    const sentResp = await request.post('/api/v1/quotes/bulk', {
      headers: authHeaders(token),
      data: { action: 'mark_sent', ids: [quoteId] },
    });
    expect(sentResp.status()).toBe(200);

    // Verify status
    const getResp = await request.get(`/api/v1/quotes/${quoteId}`, {
      headers: authHeaders(token),
    });
    expect(Number((await getResp.json()).data.status_id)).toBe(2); // Sent
  });

  test('seeded quote 123456 has correct amount', async ({ request }) => {
    const token = await getToken(request);
    // Filter by number to avoid pagination issues
    const resp = await request.get('/api/v1/quotes?number=123456', { headers: authHeaders(token) });
    expect(resp.status()).toBe(200);
    const quotes = (await resp.json()).data;
    const q = quotes.find((x: any) => x.number === '123456');
    expect(q).toBeTruthy();
    expect(Number(q.amount)).toBe(720000);
  });
});
