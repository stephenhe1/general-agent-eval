import { test, expect } from '@playwright/test';

test('explore filter - add name contains Frank and click Add button', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Click Name menuitem
  await page.locator('[role="menuitem"]:has-text("Name")').click();
  await page.waitForTimeout(300);
  
  // Now there should be a text input and a select for type, and Add/Cancel buttons
  // The last text input should be the filter value
  const textInput = page.locator('input[type="text"]');
  const textInputCount = await textInput.count();
  console.log('Text input count:', textInputCount);
  
  // Fill the filter value
  await textInput.last().fill('Frank');
  
  // Click "Add" button (not "Apply" - there's an "Add" button based on HTML)
  const addBtn = page.locator('button:has-text("Add")');
  const addCount = await addBtn.count();
  console.log('Add button count:', addCount);
  
  await addBtn.last().click();
  await page.waitForLoadState('networkidle');
  
  console.log('URL after Add:', page.url());
  
  const rowCount = await page.locator('[role="row"][data-href]').count();
  console.log('ROW COUNT after filter:', rowCount);
  
  const rows = await page.locator('[role="row"][data-href]').allTextContents();
  console.log('ROWS:', JSON.stringify(rows));
  
  await page.screenshot({ path: '/tmp/filter-frank.png' });
});

test('explore columns toggle - click and see checkboxes', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Columns")').click();
  await page.waitForTimeout(300);
  
  const body = await page.locator('body').innerText();
  console.log('BODY AFTER COLUMNS:', body.slice(0, 400));
  
  // Find column checkboxes with their labels
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Columns');
    // Find the popup near Columns button
    return body.slice(idx, idx + 2000);
  });
  console.log('COLUMNS HTML:', html);
  
  await page.screenshot({ path: '/tmp/columns-open.png' });
});

test('explore posts filter - Status filter', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  const menuItems = await page.locator('[role="menuitem"]').allTextContents();
  console.log('POSTS FILTER MENUITEMS:', JSON.stringify(menuItems));
  
  // Click Status
  await page.locator('[role="menuitem"]:has-text("Status")').click();
  await page.waitForTimeout(300);
  
  // Look at selects and inputs
  const selects = await page.locator('select').all();
  for (const sel of selects) {
    const val = await sel.inputValue();
    const opts = await sel.locator('option').allTextContents();
    console.log('SELECT:', val, opts);
  }
  
  const buttons = await page.locator('button').allTextContents();
  console.log('BUTTONS AFTER STATUS CLICK:', JSON.stringify(buttons));
  
  // Try to set status to "published" and add filter
  // The status filter might have a different UI (radio, select)
  await page.screenshot({ path: '/tmp/posts-status-filter.png' });
});

test('explore posts status filter - radio or select UI', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="menuitem"]:has-text("Status")').click();
  await page.waitForTimeout(300);
  
  // Look for the filter container HTML
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('draft');
    return body.slice(Math.max(0, idx-1000), idx + 1500);
  });
  console.log('STATUS FILTER HTML:', html);
  
  // Find radio buttons or checkboxes in the filter
  const radioInputs = await page.locator('input[type="radio"]').all();
  for (const r of radioInputs) {
    const val = await r.inputValue();
    const label = await r.getAttribute('aria-label');
    console.log('RADIO:', { val, label });
  }
});
