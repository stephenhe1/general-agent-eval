import { test, expect } from '@playwright/test';

test('explore posts status filter - click Published and Add', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="menuitem"]:has-text("Status")').click();
  await page.waitForTimeout(300);
  
  // There's a listbox with Published/Draft checkboxes
  // Click Published row
  const publishedRow = page.locator('[role="row"][aria-label="Published"]');
  const publishedCount = await publishedRow.count();
  console.log('Published row count:', publishedCount);
  
  if (publishedCount > 0) {
    await publishedRow.click();
    await page.waitForTimeout(200);
  }
  
  // Click Add
  await page.locator('button:has-text("Add")').click();
  await page.waitForLoadState('networkidle');
  
  console.log('URL after Published filter:', page.url());
  
  const rows = await page.locator('[role="row"][data-href]').allTextContents();
  console.log('ROWS:', JSON.stringify(rows));
  
  await page.screenshot({ path: '/tmp/posts-published.png' });
});

test('explore columns toggle - click Email checkbox to hide', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Verify Email column is visible
  const emailHeader = page.locator('[aria-sort]').filter({ hasText: 'Email' });
  console.log('Email header visible:', await emailHeader.isVisible());
  
  // Click Columns button
  await page.locator('button:has-text("Columns")').click();
  await page.waitForTimeout(300);
  
  // Look for popup with column toggles
  const popupHtml = await page.evaluate(() => {
    // Find the popup that opened
    const allEls = Array.from(document.querySelectorAll('[role="menu"], [role="dialog"], [role="listbox"]'));
    return allEls.map(e => e.outerHTML.slice(0, 500)).join('\n');
  });
  console.log('POPUP HTML:', popupHtml.slice(0, 1000));
  
  // Look for listview items with column names
  const listItems = await page.locator('[role="row"]').all();
  for (const item of listItems) {
    const text = await item.innerText().catch(() => '');
    if (text.includes('Email') || text.includes('Name') || text.includes('Posts')) {
      const ariaLabel = await item.getAttribute('aria-label');
      const ariaSelected = await item.getAttribute('aria-selected');
      console.log('LIST ITEM:', { text: text.slice(0,50), ariaLabel, ariaSelected });
    }
  }
  
  await page.screenshot({ path: '/tmp/columns-popup.png' });
});

test('explore columns toggle - full HTML of popup', async ({ page }) => {
  await page.goto('/authors?column=name&column=email&column=posts');
  await page.waitForLoadState('networkidle');
  
  // Click Columns button  
  const colBtn = page.locator('button:has-text("Columns")');
  await colBtn.click();
  await page.waitForTimeout(500);
  
  // Get HTML after click
  const html = await page.evaluate(() => document.body.innerHTML);
  // Find column related HTML
  const idx = html.indexOf('Email');
  console.log('COLUMNS POPUP HTML (around Email):', html.slice(Math.max(0, idx-200), idx+2000));
});

test('explore columns toggle - URL change when toggling', async ({ page }) => {
  await page.goto('/authors?column=name&column=email&column=posts');
  await page.waitForLoadState('networkidle');
  
  // Click Columns button
  await page.locator('button:has-text("Columns")').click();
  await page.waitForTimeout(300);
  
  // Find and click Email row/item to toggle it
  const emailRow = page.locator('[role="row"][aria-label="Email"]');
  const emailRowCount = await emailRow.count();
  console.log('Email row count:', emailRowCount);
  
  if (emailRowCount > 0) {
    await emailRow.click();
    await page.waitForTimeout(500);
    console.log('URL after email toggle:', page.url());
    
    // Check if Email header is gone
    const emailHeader = page.locator('[aria-sort]').filter({ hasText: 'Email' });
    const emailHeaderVisible = await emailHeader.isVisible().catch(() => false);
    console.log('Email header still visible:', emailHeaderVisible);
  }
  
  await page.screenshot({ path: '/tmp/columns-email-toggled.png' });
});
