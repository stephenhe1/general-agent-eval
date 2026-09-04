/**
 * Admin API — Products CRUD
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

test.describe('Admin API — Products', () => {
  test('GET /api/v1/products returns seeded products', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/products', {
      headers: authHeaders(token),
    });

    expect(resp.status()).toBe(200);
    const products = (await resp.json()).data;
    expect(products.length).toBeGreaterThanOrEqual(11); // 11 seeded

    const seeded = products.find((p: any) => p.product_key === 'product_name');
    expect(seeded).toBeTruthy();
    expect(Number(seeded.price)).toBe(60000);
  });

  test('POST /api/v1/products creates product and it appears in GET', async ({ request }) => {
    const token = await getToken(request);
    const productKey = `Widget-${Date.now()}`;

    const createResp = await request.post('/api/v1/products', {
      headers: authHeaders(token),
      data: { product_key: productKey, notes: 'A test widget', price: 99.99, cost: 50 },
    });
    expect(createResp.status()).toBe(200);
    const created = (await createResp.json()).data;
    expect(created.product_key).toBe(productKey);
    expect(Number(created.price)).toBe(99.99);
    const productId = created.id;

    // Verify via GET
    const getResp = await request.get(`/api/v1/products/${productId}`, {
      headers: authHeaders(token),
    });
    expect(getResp.status()).toBe(200);
    const fetched = (await getResp.json()).data;
    expect(fetched.product_key).toBe(productKey);
    expect(Number(fetched.price)).toBe(99.99);
  });

  test('PUT /api/v1/products/:id updates price', async ({ request }) => {
    const token = await getToken(request);

    // Create a product
    const createResp = await request.post('/api/v1/products', {
      headers: authHeaders(token),
      data: { product_key: `Prod-${Date.now()}`, price: 10 },
    });
    const productId = (await createResp.json()).data.id;

    // Update price
    const putResp = await request.put(`/api/v1/products/${productId}`, {
      headers: authHeaders(token),
      data: { price: 200 },
    });
    expect(putResp.status()).toBe(200);
    expect(Number((await putResp.json()).data.price)).toBe(200);

    // Confirm
    const getResp = await request.get(`/api/v1/products/${productId}`, {
      headers: authHeaders(token),
    });
    expect(Number((await getResp.json()).data.price)).toBe(200);
  });

  test('DELETE /api/v1/products/:id removes the product', async ({ request }) => {
    const token = await getToken(request);

    // Create
    const createResp = await request.post('/api/v1/products', {
      headers: authHeaders(token),
      data: { product_key: `ToDelete-${Date.now()}`, price: 5 },
    });
    const productId = (await createResp.json()).data.id;

    // Delete
    const delResp = await request.delete(`/api/v1/products/${productId}`, {
      headers: authHeaders(token),
    });
    expect(delResp.status()).toBe(200);

    // Confirm deleted/archived
    const getResp = await request.get(`/api/v1/products/${productId}`, {
      headers: authHeaders(token),
    });
    const product = (await getResp.json()).data;
    expect(product.is_deleted || product.archived_at > 0).toBe(true);
  });

  test('seeded product_name1 has price 60000', async ({ request }) => {
    const token = await getToken(request);
    const resp = await request.get('/api/v1/products', { headers: authHeaders(token) });
    const products = (await resp.json()).data;
    const p = products.find((x: any) => x.product_key === 'product_name1');
    expect(p).toBeTruthy();
    expect(Number(p.price)).toBe(60000);
  });
});
