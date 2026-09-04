import { test, expect } from '@playwright/test';

test('explore filter - find Name and add filter', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Get all elements after clicking Filter
  const allInteractive = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a, [role="option"], [role="menuitem"]'));
    return els.map(el => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      text: el.textContent?.trim().slice(0, 50)
    })).filter(e => e.text);
  });
  console.log('ALL INTERACTIVE:', JSON.stringify(allInteractive));
  
  // Check what appears after click (might be dropdown with options)
  const visibleNewElements = await page.evaluate(() => {
    // Look for any new pop-up/overlay
    const popups = Array.from(document.querySelectorAll('[class*="popup"], [class*="dropdown"], [class*="popover"]'));
    return popups.map(p => ({ class: p.className, text: p.textContent?.trim().slice(0, 100) }));
  });
  console.log('POPUPS:', JSON.stringify(visibleNewElements));
  
  // Check current URL
  console.log('URL:', page.url());
  
  // Check for list elements
  const listItems = await page.locator('li').allTextContents();
  console.log('LIST ITEMS:', JSON.stringify(listItems));
  
  await page.screenshot({ path: '/tmp/filter-state.png' });
});

test('explore filter - look for filter input after selecting Name', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Get full HTML snippet around Filter button
  const filterHtml = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Filter'));
    const parent = btn?.closest('[class]') || btn?.parentElement?.parentElement;
    return parent?.innerHTML?.slice(0, 2000);
  });
  console.log('FILTER HTML:', filterHtml);
});

test('explore filter - URL after applying name filter', async ({ page }) => {
  // Try to apply filter by URL parameter directly
  await page.goto('/authors?!name_contains_i=Frank');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  console.log('URL with filter:', url);
  
  const rows = await page.locator('[role="row"][data-href]').all();
  const rowTexts = [];
  for (const row of rows) {
    rowTexts.push(await row.textContent());
  }
  console.log('ROWS with name filter:', JSON.stringify(rowTexts));
  
  await page.screenshot({ path: '/tmp/filter-name-direct.png' });
});

test('explore filter - try different URL patterns', async ({ page }) => {
  // Try keystone filter URL formats
  const patterns = [
    '/authors?!name=Frank',
    '/authors?filters={"name":{"contains":"Frank"}}',
    '/authors?where[name][contains]=Frank',
  ];
  
  for (const p of patterns) {
    await page.goto(p);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const rowCount = await page.locator('[role="row"][data-href]').count();
    console.log('PATTERN:', p, '-> URL:', url, 'ROWS:', rowCount);
  }
});

test('explore filter button - click and examine popup structure', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot before click
  await page.screenshot({ path: '/tmp/before-filter.png' });
  
  // Click filter
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(500);
  
  // Get full body HTML (first 3000 chars)
  const html = await page.evaluate(() => document.body.innerHTML.slice(0, 4000));
  console.log('BODY HTML:', html);
});
