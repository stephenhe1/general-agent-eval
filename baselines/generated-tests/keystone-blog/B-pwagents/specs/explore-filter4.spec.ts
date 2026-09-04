import { test, expect } from '@playwright/test';

test('explore filter - click Name filter item and see what happens', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter button
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Click Name menuitem
  await page.locator('[role="menuitem"]:has-text("Name")').click();
  await page.waitForTimeout(300);
  
  const url = page.url();
  console.log('URL after Name click:', url);
  
  // Get body text
  const body = await page.locator('body').innerText();
  console.log('BODY:', body.slice(0, 500));
  
  // Look for inputs
  const inputs = await page.locator('input').all();
  for (const inp of inputs) {
    const placeholder = await inp.getAttribute('placeholder');
    const value = await inp.inputValue();
    const label = await inp.getAttribute('aria-label');
    console.log('INPUT:', { placeholder, value, label });
  }
  
  // Look for selects
  const selects = await page.locator('select').all();
  for (const sel of selects) {
    const opts = await sel.locator('option').allTextContents();
    const val = await sel.inputValue();
    console.log('SELECT:', { val, opts });
  }
  
  await page.screenshot({ path: '/tmp/filter-name-click.png' });
});

test('explore filter - fill and apply name filter', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Click Name
  await page.locator('[role="menuitem"]:has-text("Name")').click();
  await page.waitForTimeout(300);
  
  // Get all buttons now
  const buttons = await page.locator('button').allTextContents();
  console.log('BUTTONS AFTER NAME CLICK:', JSON.stringify(buttons));
  
  // Get inputs
  const inputs = await page.locator('input').all();
  console.log('INPUT COUNT:', inputs.length);
  
  // The second input might be the filter text input (first is search)
  if (inputs.length > 1) {
    // Try to fill filter value
    await inputs[inputs.length - 1].fill('Frank');
    await page.waitForTimeout(200);
    
    // Look for Apply or Submit button
    const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Filter"), button[type="submit"]');
    const applyCount = await applyBtn.count();
    console.log('Apply button count:', applyCount);
    
    if (applyCount > 0) {
      await applyBtn.first().click();
      await page.waitForTimeout(500);
    } else {
      // Try pressing Enter
      await inputs[inputs.length - 1].press('Enter');
      await page.waitForTimeout(500);
    }
    
    console.log('URL after filter apply:', page.url());
    const rowCount = await page.locator('[role="row"][data-href]').count();
    console.log('ROW COUNT:', rowCount);
  }
  
  await page.screenshot({ path: '/tmp/filter-applied.png' });
});

test('explore filter - check what the filter dropdown HTML looks like', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Click Name
  await page.locator('[role="menuitem"]:has-text("Name")').click();
  await page.waitForTimeout(300);
  
  // Get the HTML of what appeared
  const html = await page.evaluate(() => document.body.innerHTML.slice(3000, 6000));
  console.log('BODY HTML after Name filter:', html);
});

test('explore filter - look for filter container after add', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Click Name
  await page.locator('[role="menuitem"]:has-text("Name")').click();
  await page.waitForTimeout(500);
  
  // Look at changed visible elements
  const visibleInputs = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.map(i => ({
      placeholder: i.getAttribute('placeholder'),
      type: i.type,
      label: i.getAttribute('aria-label'),
      visible: !!(i.offsetWidth || i.offsetHeight)
    }));
  });
  console.log('ALL INPUTS:', JSON.stringify(visibleInputs));
  
  // Look for the filter section specifically
  const filterSection = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('contains');
    return idx > -1 ? body.slice(Math.max(0, idx-500), idx+500) : 'not found';
  });
  console.log('CONTAINS HTML:', filterSection);
  
  await page.screenshot({ path: '/tmp/filter-name-all.png' });
});
