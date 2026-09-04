import { test, expect } from '@playwright/test';

test('explore filter - click Filter button and add filter', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(500);
  
  // What appears after click?
  const body = await page.locator('body').innerText();
  console.log('BODY AFTER FILTER:', body.slice(0, 500));
  
  // Look for dropdown or form
  const dropdowns = await page.locator('select, [role="listbox"], [role="combobox"]').all();
  for (const d of dropdowns) {
    const text = await d.innerText().catch(() => d.getAttribute('aria-label'));
    console.log('DROPDOWN:', text);
  }
  
  await page.screenshot({ path: '/tmp/filter-open.png' });
});

test('explore filter - find Name filter option', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Look for "Name" option in filter
  const allText = await page.locator('body').innerText();
  console.log('FULL BODY:', allText.slice(0, 1000));
  
  // Check if there's a submenu or dropdown
  const menus = await page.locator('[role="menu"], [role="listbox"]').all();
  for (const m of menus) {
    const text = await m.innerText();
    console.log('MENU:', text.slice(0, 200));
  }
  
  // Check for filter items
  const menuItems = await page.locator('[role="menuitem"], [role="option"]').allTextContents();
  console.log('MENU ITEMS:', JSON.stringify(menuItems));
});

test('explore filter - add name contains filter step by step', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  // Click Filter button
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  // Look for Name option
  const nameMenuItem = page.locator('[role="menuitem"]:has-text("Name"), [role="option"]:has-text("Name")').first();
  const nameCount = await nameMenuItem.count();
  console.log('Name menu item count:', nameCount);
  
  if (nameCount > 0) {
    await nameMenuItem.click();
    await page.waitForTimeout(300);
    
    const bodyAfterName = await page.locator('body').innerText();
    console.log('BODY AFTER NAME CLICK:', bodyAfterName.slice(0, 600));
    
    await page.screenshot({ path: '/tmp/filter-name.png' });
    
    // Look for text input in filter
    const inputs = await page.locator('input').all();
    for (const inp of inputs) {
      const placeholder = await inp.getAttribute('placeholder');
      const type = await inp.getAttribute('type');
      const value = await inp.inputValue();
      console.log('INPUT:', { placeholder, type, value });
    }
    
    // Look for filter buttons
    const buttons = await page.locator('button').allTextContents();
    console.log('BUTTONS:', JSON.stringify(buttons));
  }
});

test('explore filter - posts status filter', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Filter")').click();
  await page.waitForTimeout(300);
  
  const menuItems = await page.locator('[role="menuitem"], [role="option"]').allTextContents();
  console.log('POSTS FILTER MENU ITEMS:', JSON.stringify(menuItems));
  
  // Try clicking Status
  const statusItem = page.locator('[role="menuitem"]:has-text("Status"), [role="option"]:has-text("Status")').first();
  if (await statusItem.count() > 0) {
    await statusItem.click();
    await page.waitForTimeout(300);
    
    const body = await page.locator('body').innerText();
    console.log('BODY AFTER STATUS:', body.slice(0, 600));
    
    await page.screenshot({ path: '/tmp/filter-status.png' });
  }
});

test('explore columns toggle', async ({ page }) => {
  await page.goto('/authors');
  await page.waitForLoadState('networkidle');
  
  await page.locator('button:has-text("Columns")').click();
  await page.waitForTimeout(300);
  
  const body = await page.locator('body').innerText();
  console.log('BODY AFTER COLUMNS:', body.slice(0, 600));
  
  const checkboxes = await page.locator('[role="checkbox"], input[type="checkbox"]').all();
  for (const cb of checkboxes) {
    const text = await cb.getAttribute('aria-label') || 'N/A';
    const checked = await cb.getAttribute('aria-checked') || await cb.isChecked().catch(() => 'unknown');
    console.log('CHECKBOX:', text, checked);
  }
  
  await page.screenshot({ path: '/tmp/columns-toggle.png' });
});

test('explore - check post list row structure for status', async ({ page }) => {
  await page.goto('/posts');
  await page.waitForLoadState('networkidle');
  
  // Get row content 
  const rows = await page.locator('[role="row"][data-href]').all();
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    const text = await rows[i].textContent();
    const href = await rows[i].getAttribute('data-href');
    console.log(`ROW ${i}:`, text?.trim()?.slice(0, 100), 'href:', href);
  }
});
