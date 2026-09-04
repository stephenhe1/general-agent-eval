import { test, expect } from '@playwright/test';

test('explore - relationship search is a create form (Add Author = creates new author inline)', async ({ page }) => {
  // So "Add author" opens a DIALOG to CREATE a new author inline, not a search
  // Let's try adding a real author via search - look for correct menu item
  
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Click Actions for Author
  await page.locator('button[aria-label="Actions for Author"]').click();
  await page.waitForTimeout(200);
  
  const menuItems = await page.locator('[role="menuitem"]').allTextContents();
  console.log('AUTHOR MENU:', JSON.stringify(menuItems));
  
  // Close menu
  await page.keyboard.press('Escape');
  
  // Check if there's another way to link author - maybe the author input box itself
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Actions for Author');
    return body.slice(Math.max(0, idx-1000), idx+100);
  });
  console.log('BEFORE AUTHOR BUTTON:', html.slice(0, 1200));
});

test('explore - how does author relationship field work on post page', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Find the author relationship field - it's probably a combobox/autocomplete
  const authorCombo = page.locator('[aria-autocomplete="list"]');
  const comboCount = await authorCombo.count();
  console.log('Autocomplete fields:', comboCount);
  
  // Type in author field
  if (comboCount > 0) {
    const firstCombo = authorCombo.first();
    const ariaLabel = await firstCombo.getAttribute('aria-label');
    const ariaLabelledby = await firstCombo.getAttribute('aria-labelledby');
    console.log('First combo:', { ariaLabel, ariaLabelledby });
    
    await firstCombo.click();
    await firstCombo.fill('Baum');
    await page.waitForTimeout(300);
    
    const listbox = page.locator('[role="listbox"]');
    const listboxCount = await listbox.count();
    console.log('Listbox count after typing Baum:', listboxCount);
    
    if (listboxCount > 0) {
      const options = await listbox.locator('[role="option"]').allTextContents();
      console.log('OPTIONS:', JSON.stringify(options));
    }
    
    await page.screenshot({ path: '/tmp/author-combobox.png' });
  }
});

test('explore - author relationship field - how to link author to post', async ({ page }) => {
  await page.goto('/posts/cmt6jom1w00088o22z2l59mje');
  await page.waitForLoadState('networkidle');
  
  // Get the full HTML around the Author section
  const html = await page.evaluate(() => {
    const body = document.body.innerHTML;
    const idx = body.indexOf('Actions for Author');
    return body.slice(Math.max(0, idx-2000), idx+200);
  });
  console.log('AUTHOR FULL HTML:', html);
});

test('explore - author field input type and how to select existing author', async ({ page }) => {
  await page.goto('/posts/create');
  await page.waitForLoadState('networkidle');
  
  // Find all autocomplete inputs
  const autocompleteInputs = await page.locator('input[aria-autocomplete]').all();
  for (const inp of autocompleteInputs) {
    const id = await inp.getAttribute('id');
    const ariaLabel = await inp.getAttribute('aria-labelledby');
    console.log('Autocomplete input:', { id, ariaLabel });
  }
  
  // The author input should be an autocomplete - fill it
  const authorInput = page.locator('input[aria-autocomplete="list"]').first();
  if (await authorInput.count() > 0) {
    const label = await page.evaluate((el) => {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const labelEl = document.getElementById(labelledby);
        return labelEl?.textContent;
      }
      return null;
    }, await authorInput.elementHandle());
    console.log('Author input label:', label);
    
    await authorInput.fill('Baum');
    await page.waitForTimeout(500);
    
    // Look for dropdown
    const listbox = page.locator('[role="listbox"], [role="option"]');
    const listboxCount = await listbox.count();
    console.log('Listbox count:', listboxCount);
    
    if (listboxCount > 0) {
      const options = await page.locator('[role="option"]').allTextContents();
      console.log('OPTIONS:', JSON.stringify(options));
    }
    
    await page.screenshot({ path: '/tmp/author-input-baum.png' });
  }
});
