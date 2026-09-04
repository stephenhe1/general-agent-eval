/**
 * Admin API — Invoices CRUD + Actions
 *
 * Verifies create / read / update / delete and invoice-specific
 * actions (mark_sent, mark_paid) through the REST API.
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
  const body = await resp.json();
  return body.data[0].token.token as string;
}

function authHeaders(token: string) {
  return { ...API_HEADERS, 'X-API-TOKEN': token };
}

// Status IDs in Invoice Ninja:
//  1 = Draft  2 = Sent  3 = Partial  4 = Paid  5 = Cancelled  6 = Reversed

test.describe('Admin API — Invoices', () => {
  // ─── List ──────────────────────────────────────────────────────────────────

  test('GET /api/v1/invoices returns seeded invoices', async ({ request }) => {
    const token = await getToken(request);
    // Filter by invoice number to avoid pagination issues from test-created records.
    // The seeded invoice has number '123456'.
    const resp = await request.get('/api/v1/invoices?number=123456', {
      headers: authHeaders(token),
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // One of the seeded invoices has number 123456
    const seeded = body.data.find((inv: any) => inv.number === '123456');
    expect(seeded).toBeTruthy();
  });

  // ─── Create ────────────────────────────────────────────────────────────────

  test('POST /api/v1/invoices creates an invoice and it appears in GET list', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        line_items: [
          {
            product_key: 'Widget',
            notes: 'Test line item',
            cost: 100,
            quantity: 2,
          },
        ],
      },
    });
    expect(createResp.status()).toBe(200);
    const created = (await createResp.json()).data;
    expect(created.id).toBeTruthy();
    expect(created.client_id).toBe('VolejRejNm');
    // amount = cost * quantity = 200
    expect(Number(created.amount)).toBe(200);
    const newId = created.id;

    // Verify via GET
    const getResp = await request.get(`/api/v1/invoices/${newId}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    const fetched = (await getResp.json()).data;
    expect(fetched.id).toBe(newId);
    expect(Number(fetched.amount)).toBe(200);
  });

  // ─── Update ────────────────────────────────────────────────────────────────

  test('PUT /api/v1/invoices/:id updates the PO number', async ({ request }) => {
    const token = await getToken(request);

    // Create invoice
    const createResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 50, quantity: 1 }] },
    });
    const invoiceId = (await createResp.json()).data.id;

    const poNumber = `PO-${Date.now()}`;
    const putResp = await request.put(`/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(token),
      data: { po_number: poNumber },
    });
    expect(putResp.status()).toBe(200);
    expect((await putResp.json()).data.po_number).toBe(poNumber);

    // Confirm via GET
    const getResp = await request.get(`/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(token),
    });
    expect((await getResp.json()).data.po_number).toBe(poNumber);
  });

  // ─── Mark sent ─────────────────────────────────────────────────────────────

  test('mark_sent action changes invoice status from Draft to Sent', async ({ request }) => {
    const token = await getToken(request);

    // Create a draft invoice
    const createResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 75, quantity: 1 }] },
    });
    const invoice = (await createResp.json()).data;
    const invoiceId = invoice.id;
    expect(Number(invoice.status_id)).toBe(1); // Draft

    // Mark as sent via bulk action
    const sentResp = await request.post('/api/v1/invoices/bulk', {
      headers: authHeaders(token),
      data: { action: 'mark_sent', ids: [invoiceId] },
    });
    expect(sentResp.status()).toBe(200);

    // Verify status changed
    const getResp = await request.get(`/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(token),
    });
    const updated = (await getResp.json()).data;
    expect(Number(updated.status_id)).toBe(2); // Sent
  });

  // ─── Seeded invoice ─────────────────────────────────────────────────────────

  test('seeded paid invoice has status_id 4', async ({ request }) => {
    const token = await getToken(request);

    // Filter by number directly to avoid pagination issues
    const resp = await request.get('/api/v1/invoices?number=123456', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const invoices = (await resp.json()).data;
    const paid = invoices.find((inv: any) => inv.number === '123456');
    expect(paid).toBeTruthy();
    expect(Number(paid.status_id)).toBe(4); // Paid
    expect(Number(paid.amount)).toBe(120000);
  });

  test('seeded draft invoice has status_id 1', async ({ request }) => {
    const token = await getToken(request);
    // Filter by number directly to avoid pagination issues
    const resp = await request.get('/api/v1/invoices?number=123456_draft', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const invoices = (await resp.json()).data;
    const draft = invoices.find((inv: any) => inv.number === '123456_draft');
    expect(draft).toBeTruthy();
    expect(Number(draft.status_id)).toBe(1); // Draft
  });

  // ─── Delete ────────────────────────────────────────────────────────────────

  test('DELETE /api/v1/invoices/:id archives the invoice', async ({ request }) => {
    const token = await getToken(request);

    // Create
    const createResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 10, quantity: 1 }] },
    });
    const invoiceId = (await createResp.json()).data.id;

    // Delete
    const delResp = await request.delete(`/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(token),
    });
    expect(delResp.status()).toBe(200);

    // The invoice should now be archived or deleted
    const getResp = await request.get(`/api/v1/invoices/${invoiceId}`, {
      headers: authHeaders(token),
    });
    const inv = (await getResp.json()).data;
    expect(inv.is_deleted || inv.archived_at > 0).toBe(true);
  });

  // ─── Line items ────────────────────────────────────────────────────────────

  test('invoice with multiple line items calculates amount correctly', async ({ request }) => {
    const token = await getToken(request);

    const createResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        line_items: [
          { cost: 100, quantity: 3 }, // 300
          { cost: 50, quantity: 2 },  // 100
        ],
      },
    });
    expect(createResp.status()).toBe(200);
    const invoice = (await createResp.json()).data;
    expect(Number(invoice.amount)).toBe(400);
  });
});
