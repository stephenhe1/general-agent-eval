/**
 * Admin API — Clients CRUD
 *
 * Uses Playwright's `request` fixture (no browser).
 * Verifies that create/update/delete operations actually change
 * persisted data as asserted through subsequent GET calls.
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

// ─── List ─────────────────────────────────────────────────────────────────────

test.describe('Admin API — Clients', () => {
  test('GET /api/v1/clients returns the seeded client', async ({ request }) => {
    const token = await getToken(request);
    // Use per_page=100 to ensure all clients (including seeded ones) are returned
    const resp = await request.get('/api/v1/clients?per_page=100', {
      headers: authHeaders(token),
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // Seeded client is company_name
    const seeded = body.data.find((c: any) => c.name === 'company_name');
    expect(seeded).toBeTruthy();
    expect(seeded.id).toBeTruthy();
  });

  // ─── Create ────────────────────────────────────────────────────────────────

  test('POST /api/v1/clients creates a client and it appears in GET list', async ({ request }) => {
    const token = await getToken(request);
    const uniqueName = `Test Client ${Date.now()}`;

    // Create
    const createResp = await request.post('/api/v1/clients', {
      headers: authHeaders(token),
      data: {
        name: uniqueName,
        contacts: [{ first_name: 'Jane', last_name: 'Doe', email: `jane.${Date.now()}@test.com` }],
      },
    });
    expect(createResp.status()).toBe(200);
    const created = (await createResp.json()).data;
    expect(created.name).toBe(uniqueName);
    const newId = created.id;
    expect(newId).toBeTruthy();

    // Verify it exists via GET
    const getResp = await request.get(`/api/v1/clients/${newId}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    const fetched = (await getResp.json()).data;
    expect(fetched.name).toBe(uniqueName);

    // Verify it appears in the list (use per_page=100 to handle pagination)
    const listResp = await request.get('/api/v1/clients?per_page=100', {
      headers: authHeaders(token),
    });
    const list = (await listResp.json()).data;
    expect(list.some((c: any) => c.id === newId)).toBe(true);
  });

  // ─── Update ────────────────────────────────────────────────────────────────

  test('PUT /api/v1/clients/:id updates the client name', async ({ request }) => {
    const token = await getToken(request);
    const original = `Client A ${Date.now()}`;
    const updated = `Client A Updated ${Date.now()}`;

    // Create a client to update
    const createResp = await request.post('/api/v1/clients', {
      headers: authHeaders(token),
      data: { name: original },
    });
    const clientId = (await createResp.json()).data.id;

    // Update
    const putResp = await request.put(`/api/v1/clients/${clientId}`, {
      headers: authHeaders(token),
      data: { name: updated },
    });
    expect(putResp.status()).toBe(200);
    const putBody = (await putResp.json()).data;
    expect(putBody.name).toBe(updated);

    // Confirm via GET
    const getResp = await request.get(`/api/v1/clients/${clientId}`, {
      headers: authHeaders(token),
    });
    expect((await getResp.json()).data.name).toBe(updated);
  });

  // ─── Delete (archive) ──────────────────────────────────────────────────────

  test('DELETE /api/v1/clients/:id archives the client', async ({ request }) => {
    const token = await getToken(request);

    // Create a client to delete
    const createResp = await request.post('/api/v1/clients', {
      headers: authHeaders(token),
      data: { name: `To Delete ${Date.now()}` },
    });
    const clientId = (await createResp.json()).data.id;

    // Delete
    const delResp = await request.delete(`/api/v1/clients/${clientId}`, {
      headers: authHeaders(token),
    });
    expect(delResp.status()).toBe(200);

    // The archived client should have is_deleted or archived_at set
    const getResp = await request.get(`/api/v1/clients/${clientId}`, {
      headers: authHeaders(token),
    });
    const client = (await getResp.json()).data;
    // Either archived or deleted
    expect(client.is_deleted || client.archived_at > 0).toBe(true);
  });

  // ─── Contact data ──────────────────────────────────────────────────────────

  test('creating client with contact stores email correctly', async ({ request }) => {
    const token = await getToken(request);
    const email = `contact.${Date.now()}@example.com`;

    const resp = await request.post('/api/v1/clients', {
      headers: authHeaders(token),
      data: {
        name: `Contact Test ${Date.now()}`,
        contacts: [{ first_name: 'Bob', last_name: 'Smith', email }],
      },
    });
    expect(resp.status()).toBe(200);
    const client = (await resp.json()).data;
    const contacts = client.contacts ?? [];
    expect(contacts.some((c: any) => c.email === email)).toBe(true);
  });

  // ─── Seeded client GET by ID ───────────────────────────────────────────────

  test('GET /api/v1/clients/VolejRejNm returns the seeded client', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/clients/VolejRejNm', {
      headers: authHeaders(token),
    });
    expect(resp.status()).toBe(200);
    const client = (await resp.json()).data;
    expect(client.name).toBe('company_name');
    expect(client.id).toBe('VolejRejNm');
  });
});
