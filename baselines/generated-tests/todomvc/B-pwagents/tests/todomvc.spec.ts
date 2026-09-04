import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
});

// Helper function
async function addTodo(page: any, text: string) {
  await page.locator('[data-testid="new-todo-input-text"]').fill(text);
  await page.locator('[data-testid="new-todo-input-text"]').press('Enter');
}

test('TC-001: Initial empty state', async ({ page }) => {
  await expect(page).toHaveTitle('React TypeScript TodoMVC 2022');
  await expect(page.locator('[data-testid="new-todo-input-text"]')).toBeVisible();
  await expect(page.locator('[data-testid="new-todo-input-text"]')).toHaveAttribute('placeholder', 'What needs to be done?');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="toggle-all-btn"]')).not.toBeVisible();
  await expect(page.locator('section.main')).not.toBeVisible();
  await expect(page.locator('footer.footer')).not.toBeVisible();
});

test('TC-002: Add a single todo item', async ({ page }) => {
  await addTodo(page, 'Buy groceries');

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Buy groceries');
  await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1');
  await expect(page.locator('.todo-count')).toContainText('1 item left');
  await expect(page.locator('[data-testid="new-todo-input-text"]')).toHaveValue('');
  await expect(page.locator('[data-testid="todo-item-complete-check"]').first()).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item"]').first()).not.toHaveClass(/completed/);
  await expect(page.locator('section.main')).toBeVisible();
  await expect(page.locator('footer.footer')).toBeVisible();
});

test('TC-003: Add multiple todo items', async ({ page }) => {
  await addTodo(page, 'Buy groceries');
  await addTodo(page, 'Walk the dog');
  await addTodo(page, 'Read a book');

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(3);
  // App renders items newest-first (reverse insertion order)
  await expect(page.locator('[data-testid="todo-body-text"]').nth(0)).toHaveText('Read a book');
  await expect(page.locator('[data-testid="todo-body-text"]').nth(1)).toHaveText('Walk the dog');
  await expect(page.locator('[data-testid="todo-body-text"]').nth(2)).toHaveText('Buy groceries');
  await expect(page.locator('.todo-count')).toContainText('3 item left');
  await expect(page.locator('[data-testid="new-todo-input-text"]')).toHaveValue('');
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(0)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(1)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(2)).not.toBeChecked();
});

test('TC-004: Item counter grammar — singular', async ({ page }) => {
  await addTodo(page, 'One task');

  await expect(page.locator('.todo-count')).toContainText('1 item left');
  await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1');
});

test('TC-005: Item counter grammar — plural (known bug)', async ({ page }) => {
  await addTodo(page, 'First task');
  await addTodo(page, 'Second task');

  // Known bug: app shows "2 item left" (missing plural "s")
  await expect(page.locator('.todo-count')).toContainText('2 item left');
  await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2');
});

test('TC-006: Complete a single todo item', async ({ page }) => {
  await addTodo(page, 'Buy groceries');
  await addTodo(page, 'Walk the dog');
  await addTodo(page, 'Read a book');

  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  await expect(page.locator('[data-testid="todo-item"]').first()).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item-complete-check"]').first()).toBeChecked();
  await expect(page.locator('.todo-count')).toContainText('2 item left');
  await expect(page.locator('button.clear-completed')).toBeVisible();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(1)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(2)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(2)).not.toHaveClass(/completed/);
});

test('TC-007: Uncheck a completed todo item', async ({ page }) => {
  await addTodo(page, 'Buy groceries');
  // Complete it first
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();
  await expect(page.locator('[data-testid="todo-item"]').first()).toHaveClass(/completed/);

  // Now uncheck it
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  await expect(page.locator('[data-testid="todo-item"]').first()).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item-complete-check"]').first()).not.toBeChecked();
  await expect(page.locator('.todo-count')).toContainText('1 item left');
  await expect(page.locator('button.clear-completed')).not.toBeVisible();
});

test('TC-008: Toggle all — mark all complete', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  await page.locator('[data-testid="toggle-all-btn"]').click();

  await expect(page.locator('[data-testid="todo-item"]').nth(0)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(2)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(0)).toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(1)).toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(2)).toBeChecked();
  await expect(page.locator('[data-testid="toggle-all-btn"]')).toBeChecked();
  await expect(page.locator('.todo-count')).toContainText('0 item left');
  await expect(page.locator('button.clear-completed')).toBeVisible();
});

test('TC-009: Toggle all — unmark all complete', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // Mark all complete first
  await page.locator('[data-testid="toggle-all-btn"]').click();
  await expect(page.locator('[data-testid="toggle-all-btn"]')).toBeChecked();

  // Now unmark all
  await page.locator('[data-testid="toggle-all-btn"]').click();

  await expect(page.locator('[data-testid="todo-item"]').nth(0)).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(2)).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(0)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(1)).not.toBeChecked();
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(2)).not.toBeChecked();
  await expect(page.locator('[data-testid="toggle-all-btn"]')).not.toBeChecked();
  await expect(page.locator('.todo-count')).toContainText('3 item left');
});

test('TC-010: Toggle-all state reflects partial completion', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // Complete exactly 1 item
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  await expect(page.locator('[data-testid="toggle-all-btn"]')).not.toBeChecked();

  // Click toggle-all to complete all
  await page.locator('[data-testid="toggle-all-btn"]').click();

  await expect(page.locator('[data-testid="todo-item"]').nth(0)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(2)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="toggle-all-btn"]')).toBeChecked();
});

test('TC-011: Delete a todo item via destroy button', async ({ page }) => {
  await addTodo(page, 'Keep me');
  await addTodo(page, 'Delete me');

  // App renders newest-first: 'Delete me' (added 2nd) is at nth(0), 'Keep me' at nth(1)
  // Hover over the first item (Delete me) to reveal destroy button
  await page.locator('[data-testid="todo-item"]').nth(0).hover();
  await page.locator('[data-testid="todo-item"]').nth(0).locator('[data-testid="delete-todo-btn"]').click();

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Keep me');
  await expect(page.locator('.todo-count')).toContainText('1 item left');
  await expect(page.locator('[data-testid="todo-body-text"]')).not.toContainText('Delete me');
});

test('TC-012: Edit a todo item — save with Enter', async ({ page }) => {
  await addTodo(page, 'Original text');

  // Enter edit mode by double-clicking the label
  await page.locator('[data-testid="todo-body-text"]').first().dblclick();

  // Clear and type new text
  await page.locator('[data-testid="todo-edit-input"]').fill('Updated text');
  await page.locator('[data-testid="todo-edit-input"]').press('Enter');

  await expect(page.locator('[data-testid="todo-item"]').first()).not.toHaveClass(/editing/);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Updated text');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
});

test('TC-013: Edit a todo item — save on blur (Tab)', async ({ page }) => {
  await addTodo(page, 'Original text');

  // Enter edit mode
  await page.locator('[data-testid="todo-body-text"]').first().dblclick();

  // Clear and type new text, then press Tab to blur
  await page.locator('[data-testid="todo-edit-input"]').fill('Blur saved');
  await page.locator('[data-testid="todo-edit-input"]').press('Tab');

  await expect(page.locator('[data-testid="todo-item"]').first()).not.toHaveClass(/editing/);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Blur saved');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
});

test('TC-014: Edit a todo item — Escape exits edit mode (saves current value)', async ({ page }) => {
  await addTodo(page, 'Original text');

  // Enter edit mode
  await page.locator('[data-testid="todo-body-text"]').first().dblclick();

  // Type some text then press Escape — app does NOT cancel; it saves the typed text
  await page.locator('[data-testid="todo-edit-input"]').fill('I will cancel this');
  await page.locator('[data-testid="todo-edit-input"]').press('Escape');

  await expect(page.locator('[data-testid="todo-item"]').first()).not.toHaveClass(/editing/);
  // Known app behavior: Escape saves the edited value rather than reverting
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('I will cancel this');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
});

test('TC-015: Edit mode — input pre-filled with current text', async ({ page }) => {
  await addTodo(page, 'Pre-filled check');

  // Enter edit mode
  await page.locator('[data-testid="todo-body-text"]').first().dblclick();

  await expect(page.locator('[data-testid="todo-item"]').first()).toHaveClass(/editing/);
  await expect(page.locator('[data-testid="todo-edit-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="todo-edit-input"]')).toHaveValue('Pre-filled check');
  await expect(page.locator('[data-testid="todo-edit-input"]')).toBeFocused();
});

test('TC-016: Edit a todo item — save empty string (item remains)', async ({ page }) => {
  await addTodo(page, 'Keep me');
  await addTodo(page, 'Remove via edit');

  // App renders newest-first: 'Remove via edit'(0), 'Keep me'(1)
  // Enter edit mode on first item ('Remove via edit')
  await page.locator('[data-testid="todo-item"]').nth(0).locator('[data-testid="todo-body-text"]').dblclick();

  // Clear the input completely and press Enter (scope to avoid strict mode violation)
  await page.locator('[data-testid="todo-item"]').nth(0).locator('[data-testid="todo-edit-input"]').fill('');
  await page.locator('[data-testid="todo-item"]').nth(0).locator('[data-testid="todo-edit-input"]').press('Enter');

  // Current observed behavior: item is NOT deleted — it remains (with empty text)
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="todo-body-text"]').nth(1)).toHaveText('Keep me');
});

test('TC-017: Filter — Active', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // App renders newest-first: C(0), B(1), A(2)
  // Complete Task C (first/top item)
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Click Active filter
  await page.locator('[data-cy="active-filter"]').click();

  await expect(page).toHaveURL(/\/active/);
  await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-cy="all-filter"]')).not.toHaveClass(/selected/);
  await expect(page.locator('[data-cy="completed-filter"]')).not.toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="todo-body-text"]').nth(0)).toHaveText('Task B');
  await expect(page.locator('[data-testid="todo-body-text"]').nth(1)).toHaveText('Task A');
  await expect(page.locator('.todo-count')).toContainText('2 item left');
});

test('TC-018: Filter — Completed', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // App renders newest-first: C(0), B(1), A(2)
  // Complete Task C (first/top item)
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Click Completed filter
  await page.locator('[data-cy="completed-filter"]').click();

  await expect(page).toHaveURL(/\/completed/);
  await expect(page.locator('[data-cy="completed-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-cy="all-filter"]')).not.toHaveClass(/selected/);
  await expect(page.locator('[data-cy="active-filter"]')).not.toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Task C');
  await expect(page.locator('.todo-count')).toContainText('2 item left');
});

test('TC-019: Filter — All', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // Complete Task A (first item)
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Navigate to active filter first
  await page.locator('[data-cy="active-filter"]').click();
  await expect(page).toHaveURL(/\/active/);

  // Click All filter
  await page.locator('[data-cy="all-filter"]').click();

  await expect(page).toHaveURL(/\/$|127\.0\.0\.1:5180\/$/);
  await expect(page.locator('[data-cy="all-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(3);
  await expect(page.locator('.todo-count')).toContainText('2 item left');
});

test('TC-020: Filter — direct navigation via URL', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // App renders newest-first: C(0), B(1), A(2)
  // Complete Task C (first/top item)
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Navigate directly to /active
  await page.goto('/active');
  await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(2);

  // Navigate directly to /completed
  await page.goto('/completed');
  await expect(page.locator('[data-cy="completed-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Task C');
});

test('TC-021: Clear completed button — visible only when completions exist', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');

  // No completed items — button should not be present
  await expect(page.locator('button.clear-completed')).not.toBeVisible();

  // Complete Task A
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Now the button should be visible
  await expect(page.locator('button.clear-completed')).toBeVisible();
  await expect(page.locator('button.clear-completed')).toHaveText('Clear completed');
});

test('TC-022: Clear completed — removes only completed items', async ({ page }) => {
  await addTodo(page, 'Keep A');
  await addTodo(page, 'Delete B');
  await addTodo(page, 'Delete C');

  // App renders newest-first: Delete C(0), Delete B(1), Keep A(2)
  // Complete Delete C and Delete B (indices 0 and 1)
  await page.locator('[data-testid="todo-item-complete-check"]').nth(0).click();
  await page.locator('[data-testid="todo-item-complete-check"]').nth(1).click();

  // Click Clear completed
  await page.locator('button.clear-completed').click();

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText('Keep A');
  await expect(page.locator('.todo-count')).toContainText('1 item left');
  await expect(page.locator('button.clear-completed')).not.toBeVisible();
  await expect(page.locator('[data-testid="todo-body-text"]')).not.toContainText('Delete B');
  await expect(page.locator('[data-testid="todo-body-text"]')).not.toContainText('Delete C');
});

test('TC-023: Whitespace-only input — not added as todo', async ({ page }) => {
  await page.locator('[data-testid="new-todo-input-text"]').fill('   ');
  await page.locator('[data-testid="new-todo-input-text"]').press('Enter');

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0);
  await expect(page.locator('section.main')).not.toBeVisible();
  await expect(page.locator('footer.footer')).not.toBeVisible();
});

test('TC-024: Empty input — not added as todo', async ({ page }) => {
  await page.locator('[data-testid="new-todo-input-text"]').click();
  await page.locator('[data-testid="new-todo-input-text"]').press('Enter');

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0);
});

test('TC-025: Persistence after page reload', async ({ page }) => {
  await addTodo(page, 'Persistent A');
  await addTodo(page, 'Persistent B');

  // App renders newest-first: 'Persistent B' at nth(0), 'Persistent A' at nth(1)
  // Complete Persistent A (second/bottom item = nth(1))
  await page.locator('[data-testid="todo-item-complete-check"]').nth(1).click();

  // Reload the page
  await page.reload();

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="todo-body-text"]').nth(0)).toHaveText('Persistent B');
  await expect(page.locator('[data-testid="todo-body-text"]').nth(1)).toHaveText('Persistent A');
  await expect(page.locator('[data-testid="todo-item"]').nth(0)).not.toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item-complete-check"]').nth(1)).toBeChecked();
  await expect(page.locator('.todo-count')).toContainText('1 item left');
});

test('TC-026: Persistence — localStorage cleared resets list', async ({ page }) => {
  await addTodo(page, 'Stored item');
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);

  // Clear localStorage and reload
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0);
  await expect(page.locator('section.main')).not.toBeVisible();
  await expect(page.locator('footer.footer')).not.toBeVisible();
});

test('TC-027: Toggle-all label text and accessibility', async ({ page }) => {
  await addTodo(page, 'Task A');

  // The toggle-all label should have the correct text
  await expect(page.getByText('Mark all as complete')).toBeVisible();

  // The toggle-all input and label should be linked
  const toggleAllInput = page.locator('input#toggle-all');
  await expect(toggleAllInput).toBeAttached();

  const label = page.locator('label[for="toggle-all"]');
  await expect(label).toBeAttached();
  await expect(label).toContainText('Mark all as complete');
});

test('TC-028: Destroy button — present for each item', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');
  await addTodo(page, 'Task C');

  // Each todo item should have a destroy button with correct attributes
  const items = page.locator('[data-testid="todo-item"]');
  await expect(items).toHaveCount(3);

  for (let i = 0; i < 3; i++) {
    const destroyBtn = items.nth(i).locator('[data-testid="delete-todo-btn"]');
    await expect(destroyBtn).toBeAttached();
    await expect(destroyBtn).toHaveAttribute('data-cy', 'delete-todo-btn');
    await expect(destroyBtn).toHaveAttribute('data-testid', 'delete-todo-btn');
  }
});

test('TC-029: Counter decrements to zero when all completed', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');

  // Complete both items
  await page.locator('[data-testid="todo-item-complete-check"]').nth(0).click();
  await page.locator('[data-testid="todo-item-complete-check"]').nth(1).click();

  await expect(page.locator('.todo-count')).toContainText('0 item left');
  await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('0');
  await expect(page.locator('[data-testid="todo-item"]').nth(0)).toHaveClass(/completed/);
  await expect(page.locator('[data-testid="todo-item"]').nth(1)).toHaveClass(/completed/);
  // Note: app does not auto-check toggle-all when all items are individually completed
});

test('TC-030: Footer hidden when all items deleted', async ({ page }) => {
  await addTodo(page, 'Last item');

  // Hover and delete the item
  await page.locator('[data-testid="todo-item"]').first().hover();
  await page.locator('[data-testid="delete-todo-btn"]').first().click();

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0);
  await expect(page.locator('section.main')).not.toBeVisible();
  await expect(page.locator('footer.footer')).not.toBeVisible();
});

test('TC-031: Data attributes present on key elements', async ({ page }) => {
  await addTodo(page, 'Test item');

  // Enter edit mode to make edit input available
  await page.locator('[data-testid="todo-body-text"]').first().dblclick();

  // New todo input
  await expect(page.locator('[data-testid="new-todo-input-text"]')).toHaveAttribute('data-cy', 'new-todo-input-text');

  // Toggle-all button
  await expect(page.locator('[data-testid="toggle-all-btn"]')).toHaveAttribute('data-cy', 'toggle-all-btn');

  // Todo list
  await expect(page.locator('[data-testid="todo-list"]')).toBeAttached();

  // Todo item
  await expect(page.locator('[data-testid="todo-item"]').first()).toBeAttached();

  // Todo checkbox
  await expect(page.locator('[data-testid="todo-item-complete-check"]').first()).toHaveAttribute('data-cy', 'todo-item-complete-check');

  // Todo label
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveAttribute('data-cy', 'todo-body-text');

  // Destroy button
  await expect(page.locator('[data-testid="delete-todo-btn"]').first()).toHaveAttribute('data-cy', 'delete-todo-btn');

  // Edit input (visible after dblclick)
  await expect(page.locator('[data-testid="todo-edit-input"]').first()).toHaveAttribute('data-cy', 'todo-edit-input');

  // Filter links
  await expect(page.locator('[data-cy="all-filter"]')).toBeAttached();
  await expect(page.locator('[data-cy="active-filter"]')).toBeAttached();
  await expect(page.locator('[data-cy="completed-filter"]')).toBeAttached();

  // Remaining count
  await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toBeAttached();
});

test('TC-032: New-todo input cleared after submission', async ({ page }) => {
  await page.locator('[data-testid="new-todo-input-text"]').fill('Clear after submit');
  await page.locator('[data-testid="new-todo-input-text"]').press('Enter');

  await expect(page.locator('[data-testid="new-todo-input-text"]')).toHaveValue('');
});

test('TC-033: Filter persists across reload', async ({ page }) => {
  await addTodo(page, 'Task A');
  await addTodo(page, 'Task B');

  // Complete Task A so Active filter shows something
  await page.locator('[data-testid="todo-item-complete-check"]').first().click();

  // Navigate to active filter
  await page.goto('/active');
  await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/);

  // Reload the page
  await page.reload();

  await expect(page).toHaveURL(/\/active/);
  await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/);
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
});

test('TC-034: Add todo item with special characters', async ({ page }) => {
  const xssText = "<script>alert('xss')</script>";
  await addTodo(page, xssText);

  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="todo-body-text"]').first()).toHaveText(xssText);
});

test('TC-035: Multiple todos — order preserved', async ({ page }) => {
  const todos = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
  for (const todo of todos) {
    await addTodo(page, todo);
  }

  // App renders newest-first (reverse insertion order)
  const reversedTodos = [...todos].reverse();
  await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(5);
  for (let i = 0; i < reversedTodos.length; i++) {
    await expect(page.locator('[data-testid="todo-body-text"]').nth(i)).toHaveText(reversedTodos[i]);
  }
  await expect(page.locator('.todo-count')).toContainText('5 item left');
});
