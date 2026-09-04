/**
 * Admin API — Payments CRUD
 *
 * Payment type IDs (common):
 *  1 = Bank Transfer  2 = Cash  4 = Credit Card
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

test.describe('Admin API — Payments', () => {
  test('GET /api/v1/payments returns seeded payment', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/payments', {
      headers: authHeaders(token),
    });

    expect(resp.status()).toBe(200);
    const payments = (await resp.json()).data;
    expect(payments.length).toBeGreaterThanOrEqual(1);

    // Seeded payment: amount=120000, type_id=1 (Bank Transfer)
    const seeded = payments.find((p: any) => Number(p.amount) === 120000);
    expect(seeded).toBeTruthy();
    expect(seeded.client_id).toBe('VolejRejNm');
  });

  test('GET /api/v1/payments/VolejRejNm returns the seeded payment detail', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/payments/VolejRejNm', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const payment = (await resp.json()).data;
    expect(Number(payment.amount)).toBe(120000);
    expect(payment.client_id).toBe('VolejRejNm');
  });

  test('POST /api/v1/payments creates a payment and it appears in GET list', async ({ request }) => {
    const token = await getToken(request);

    // First create a fresh invoice to pay
    const invResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        line_items: [{ cost: 500, quantity: 1 }],
      },
    });
    expect(invResp.status()).toBe(200);
    const inv = (await invResp.json()).data;
    const invoiceId = inv.id;

    // Mark as sent first (otherwise can't apply payment)
    await request.post('/api/v1/invoices/bulk', {
      headers: authHeaders(token),
      data: { action: 'mark_sent', ids: [invoiceId] },
    });

    // Create payment
    const payResp = await request.post('/api/v1/payments', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        amount: 500,
        type_id: '1', // Bank Transfer
        invoices: [{ invoice_id: invoiceId, amount: 500 }],
      },
    });
    expect(payResp.status()).toBe(200);
    const payment = (await payResp.json()).data;
    expect(Number(payment.amount)).toBe(500);
    expect(payment.client_id).toBe('VolejRejNm');
    const paymentId = payment.id;

    // Verify it appears in list (use per_page=100 to handle pagination)
    const listResp = await request.get('/api/v1/payments?per_page=100', {
      headers: authHeaders(token),
    });
    const payments = (await listResp.json()).data;
    expect(payments.some((p: any) => p.id === paymentId)).toBe(true);
  });

  test('creating a payment for an invoice changes invoice status to Paid', async ({ request }) => {
    const token = await getToken(request);

    // Create invoice
    const invResp = await request.post('/api/v1/invoices', {
      headers: authHeaders(token),
      data: { client_id: 'VolejRejNm', line_items: [{ cost: 250, quantity: 1 }] },
    });
    const invoice = (await invResp.json()).data;
    expect(Number(invoice.status_id)).toBe(1); // Draft

    // Mark sent
    await request.post('/api/v1/invoices/bulk', {
      headers: authHeaders(token),
      data: { action: 'mark_sent', ids: [invoice.id] },
    });

    // Pay
    const payResp = await request.post('/api/v1/payments', {
      headers: authHeaders(token),
      data: {
        client_id: 'VolejRejNm',
        amount: 250,
        type_id: '1',
        invoices: [{ invoice_id: invoice.id, amount: 250 }],
      },
    });
    expect(payResp.status()).toBe(200);

    // Invoice should now be Paid (status_id 4)
    const getResp = await request.get(`/api/v1/invoices/${invoice.id}`, {
      headers: authHeaders(token),
    });
    const updatedInvoice = (await getResp.json()).data;
    expect(Number(updatedInvoice.status_id)).toBe(4); // Paid
    expect(Number(updatedInvoice.balance)).toBe(0);
  });
});
