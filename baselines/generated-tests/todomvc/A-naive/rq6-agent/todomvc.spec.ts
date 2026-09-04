import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clear all todos by resetting localStorage and reloading the page.
 * This ensures every test starts with a clean slate.
 */
async function clearState(page: Page): Promise<void> {
  await page.evaluate(() => window.localStorage.removeItem('APP_STATE'))
  await page.reload()
  // Wait for the app to be ready (new-todo input is always rendered)
  await page.waitForSelector('[data-cy="new-todo-input-text"]')
}

/**
 * Add a todo item via the new-todo input.
 */
async function addTodo(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('new-todo-input-text')
  await input.fill(text)
  await input.press('Enter')
}

/**
 * Get all visible todo item `li` elements (data-testid="todo-item" is on the li).
 */
function getTodoItems(page: Page) {
  return page.getByTestId('todo-item')
}

/**
 * Click the delete (destroy) button on a todo item.
 * The destroy button is only visible on hover in the classic TodoMVC CSS.
 */
async function deleteTodoItem(page: Page, itemLocator: ReturnType<typeof getTodoItems>) {
  await itemLocator.hover()
  await itemLocator.getByTestId('delete-todo-btn').click()
}

// ---------------------------------------------------------------------------
// Test setup – navigate to home and clear state before each test
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearState(page)
})

// ---------------------------------------------------------------------------
// Pages / Routes
// ---------------------------------------------------------------------------

test.describe('Routes', () => {
  test('/ renders the TodoMVC app', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('todos')
    await expect(page.getByTestId('new-todo-input-text')).toBeVisible()
  })

  test('/active renders the TodoMVC app', async ({ page }) => {
    await page.goto('/active')
    await expect(page.locator('h1')).toHaveText('todos')
    await expect(page.getByTestId('new-todo-input-text')).toBeVisible()
  })

  test('/completed renders the TodoMVC app', async ({ page }) => {
    await page.goto('/completed')
    await expect(page.locator('h1')).toHaveText('todos')
    await expect(page.getByTestId('new-todo-input-text')).toBeVisible()
  })

  test('unknown route shows 404 page', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.locator('[data-cy="not-found-page"]')).toBeVisible()
    await expect(page.locator('[data-cy="not-found-page"] h1')).toHaveText('Page Not Found')
  })
})

// ---------------------------------------------------------------------------
// Header / Input
// ---------------------------------------------------------------------------

test.describe('New todo input', () => {
  test('adds a todo when Enter is pressed', async ({ page }) => {
    await addTodo(page, 'Buy groceries')
    const items = getTodoItems(page)
    await expect(items).toHaveCount(1)
    await expect(items.first().getByTestId('todo-body-text')).toHaveText('Buy groceries')
  })

  test('input is cleared after adding a todo', async ({ page }) => {
    const input = page.getByTestId('new-todo-input-text')
    await input.fill('Temporary task')
    await input.press('Enter')
    await expect(input).toHaveValue('')
  })

  test('pressing Enter with blank/whitespace input does not add a todo', async ({ page }) => {
    const input = page.getByTestId('new-todo-input-text')
    await input.fill('   ')
    await input.press('Enter')
    await expect(getTodoItems(page)).toHaveCount(0)
    // Footer should not be visible (no todos)
    await expect(page.locator('.footer')).not.toBeVisible()
  })

  test('pressing Enter with empty input does not add a todo', async ({ page }) => {
    const input = page.getByTestId('new-todo-input-text')
    await input.press('Enter')
    await expect(getTodoItems(page)).toHaveCount(0)
  })

  test('new-todo input is auto-focused on page load', async ({ page }) => {
    const input = page.getByTestId('new-todo-input-text')
    await expect(input).toBeFocused()
  })

  test('can add multiple todos', async ({ page }) => {
    await addTodo(page, 'First task')
    await addTodo(page, 'Second task')
    await addTodo(page, 'Third task')
    await expect(getTodoItems(page)).toHaveCount(3)
  })

  test('new todo is prepended to the list (newest first)', async ({ page }) => {
    await addTodo(page, 'First task')
    await addTodo(page, 'Second task')
    const items = getTodoItems(page)
    // "Second task" was added last and should appear first (prepended)
    await expect(items.nth(0).getByTestId('todo-body-text')).toHaveText('Second task')
    await expect(items.nth(1).getByTestId('todo-body-text')).toHaveText('First task')
  })
})

// ---------------------------------------------------------------------------
// Todo Item Interactions
// ---------------------------------------------------------------------------

test.describe('Todo item interactions', () => {
  // Note: data-testid="todo-item" is on the <li> element directly,
  // so getByTestId('todo-item') returns the li itself.

  test('clicking checkbox marks todo as completed', async ({ page }) => {
    await addTodo(page, 'Complete me')
    const item = getTodoItems(page).first()
    const checkbox = item.getByTestId('todo-item-complete-check')
    await checkbox.check()
    // The li element (item itself) should have 'completed' class
    await expect(item).toHaveClass(/completed/)
    // Counter should show 0 remaining
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('0')
  })

  test('clicking checkbox again unmarks completed todo', async ({ page }) => {
    await addTodo(page, 'Toggle me')
    const item = getTodoItems(page).first()
    const checkbox = item.getByTestId('todo-item-complete-check')
    // Complete
    await checkbox.check()
    await expect(item).toHaveClass(/completed/)
    // Un-complete
    await checkbox.uncheck()
    await expect(item).not.toHaveClass(/completed/)
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1')
  })

  test('delete button removes a todo', async ({ page }) => {
    await addTodo(page, 'Delete me')
    await addTodo(page, 'Keep me')
    await expect(getTodoItems(page)).toHaveCount(2)
    // List order (newest first): "Keep me"(0), "Delete me"(1)
    const firstItem = getTodoItems(page).first()
    await expect(firstItem.getByTestId('todo-body-text')).toHaveText('Keep me')
    // Hover to reveal destroy button, then click
    await deleteTodoItem(page, firstItem)
    // Should now have 1 item remaining
    await expect(getTodoItems(page)).toHaveCount(1)
    await expect(getTodoItems(page).first().getByTestId('todo-body-text')).toHaveText('Delete me')
  })

  test('deleting the only todo hides the footer', async ({ page }) => {
    await addTodo(page, 'Only todo')
    await expect(page.locator('.footer')).toBeVisible()
    await deleteTodoItem(page, getTodoItems(page).first())
    await expect(page.locator('.footer')).not.toBeVisible()
  })

  test('double-clicking a todo label enters edit mode', async ({ page }) => {
    await addTodo(page, 'Edit me')
    const item = getTodoItems(page).first()
    const label = item.getByTestId('todo-body-text')
    await label.dblclick()
    // Edit input should be visible and focused
    const editInput = item.getByTestId('todo-edit-input')
    await expect(editInput).toBeVisible()
    await expect(editInput).toBeFocused()
    // li element (item itself) should have 'editing' class
    await expect(item).toHaveClass(/editing/)
  })

  test('editing a todo and pressing Enter saves the new text', async ({ page }) => {
    await addTodo(page, 'Original text')
    const item = getTodoItems(page).first()
    await item.getByTestId('todo-body-text').dblclick()
    const editInput = item.getByTestId('todo-edit-input')
    await editInput.fill('Updated text')
    await editInput.press('Enter')
    // Edit mode should exit
    await expect(item).not.toHaveClass(/editing/)
    // New text should be visible
    await expect(item.getByTestId('todo-body-text')).toHaveText('Updated text')
  })

  test('editing a todo and pressing Escape exits edit mode when text is valid', async ({ page }) => {
    await addTodo(page, 'Original text')
    const item = getTodoItems(page).first()
    await item.getByTestId('todo-body-text').dblclick()
    const editInput = item.getByTestId('todo-edit-input')
    await editInput.fill('Changed text')
    await editInput.press('Escape')
    // Edit mode should exit (app exits edit on Escape when text is non-empty)
    await expect(item).not.toHaveClass(/editing/)
  })

  test('editing a todo and blurring saves the new text', async ({ page }) => {
    await addTodo(page, 'Blur save test')
    const item = getTodoItems(page).first()
    await item.getByTestId('todo-body-text').dblclick()
    const editInput = item.getByTestId('todo-edit-input')
    await editInput.fill('Saved via blur')
    // Click elsewhere to blur
    await page.locator('h1').click()
    // Edit mode should exit and text saved
    await expect(item).not.toHaveClass(/editing/)
    await expect(item.getByTestId('todo-body-text')).toHaveText('Saved via blur')
  })

  test('editing to empty text and blurring deletes the item', async ({ page }) => {
    await addTodo(page, 'To be removed by edit')
    await addTodo(page, 'Survivor')
    await expect(getTodoItems(page)).toHaveCount(2)
    // List order (newest first): "Survivor"(0), "To be removed by edit"(1)
    const firstItem = getTodoItems(page).first()
    await expect(firstItem.getByTestId('todo-body-text')).toHaveText('Survivor')
    // Edit "Survivor" to empty text
    await firstItem.getByTestId('todo-body-text').dblclick()
    const editInput = firstItem.getByTestId('todo-edit-input')
    await editInput.fill('')
    // Blur to trigger deletion
    await page.locator('h1').click()
    // "Survivor" item should be deleted
    await expect(getTodoItems(page)).toHaveCount(1)
    await expect(getTodoItems(page).first().getByTestId('todo-body-text')).toHaveText('To be removed by edit')
  })
})

// ---------------------------------------------------------------------------
// Bulk Actions
// ---------------------------------------------------------------------------

test.describe('Bulk actions', () => {
  test('toggle-all checkbox completes all todos', async ({ page }) => {
    await addTodo(page, 'Task 1')
    await addTodo(page, 'Task 2')
    await addTodo(page, 'Task 3')
    const toggleAll = page.getByTestId('toggle-all-btn')
    await toggleAll.check()
    // All items should be completed
    const items = getTodoItems(page)
    for (let i = 0; i < 3; i++) {
      await expect(items.nth(i)).toHaveClass(/completed/)
    }
    // Counter should be 0
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('0')
  })

  test('toggle-all unchecked uncompletes all todos', async ({ page }) => {
    await addTodo(page, 'Task 1')
    await addTodo(page, 'Task 2')
    // First complete all
    const toggleAll = page.getByTestId('toggle-all-btn')
    await toggleAll.check()
    // Then uncheck
    await toggleAll.uncheck()
    const items = getTodoItems(page)
    for (let i = 0; i < 2; i++) {
      await expect(items.nth(i)).not.toHaveClass(/completed/)
    }
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
  })

  test('clear completed removes all completed todos and keeps active ones', async ({ page }) => {
    await addTodo(page, 'Active task')
    await addTodo(page, 'Will complete')
    await addTodo(page, 'Also active')
    // List order (newest first): "Also active"(0), "Will complete"(1), "Active task"(2)
    await getTodoItems(page).nth(1).getByTestId('todo-item-complete-check').check()
    // "Clear completed" button should appear
    const clearBtnByCy = page.locator('[data-cy="clear-completed-button"]')
    await expect(clearBtnByCy).toBeVisible()
    await clearBtnByCy.click()
    // Should have 2 items remaining (Also active + Active task)
    await expect(getTodoItems(page)).toHaveCount(2)
    // None should be completed
    const remaining = getTodoItems(page)
    for (let i = 0; i < 2; i++) {
      await expect(remaining.nth(i)).not.toHaveClass(/completed/)
    }
    // "Clear completed" button should be gone
    await expect(clearBtnByCy).not.toBeVisible()
  })

  test('clear completed button not shown when no completed todos', async ({ page }) => {
    await addTodo(page, 'Active only')
    await expect(page.locator('[data-cy="clear-completed-button"]')).not.toBeVisible()
  })

  test('clear completed removes only completed items, preserving active count', async ({ page }) => {
    await addTodo(page, 'Keep 1')
    await addTodo(page, 'Keep 2')
    await addTodo(page, 'Remove 1')
    await addTodo(page, 'Remove 2')
    // List (newest first): Remove 2(0), Remove 1(1), Keep 2(2), Keep 1(3)
    await getTodoItems(page).nth(0).getByTestId('todo-item-complete-check').check()
    await getTodoItems(page).nth(1).getByTestId('todo-item-complete-check').check()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
    await page.locator('[data-cy="clear-completed-button"]').click()
    await expect(getTodoItems(page)).toHaveCount(2)
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
    // Verify remaining items are Keep 2 and Keep 1
    const texts = await page.locator('[data-testid="todo-body-text"]').allTextContents()
    expect(texts).toContain('Keep 1')
    expect(texts).toContain('Keep 2')
    expect(texts).not.toContain('Remove 1')
    expect(texts).not.toContain('Remove 2')
  })
})

// ---------------------------------------------------------------------------
// Footer / Counter
// ---------------------------------------------------------------------------

test.describe('Footer counter', () => {
  test('counter shows 1 item left for one active todo', async ({ page }) => {
    await addTodo(page, 'Single task')
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1')
  })

  test('counter reflects uncompleted count with mixed todos', async ({ page }) => {
    await addTodo(page, 'Task A')
    await addTodo(page, 'Task B')
    await addTodo(page, 'Task C')
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('3')
    // Complete first item
    await getTodoItems(page).nth(0).getByTestId('todo-item-complete-check').check()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
    // Complete second item
    await getTodoItems(page).nth(1).getByTestId('todo-item-complete-check').check()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1')
    // Complete third
    await getTodoItems(page).nth(2).getByTestId('todo-item-complete-check').check()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('0')
  })
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

test.describe('Filters', () => {
  test.beforeEach(async ({ page }) => {
    // Set up: 2 active, 1 completed
    // Add in order so list (newest first) = "Completed C"(0), "Active B"(1), "Active A"(2)
    await addTodo(page, 'Active A')
    await addTodo(page, 'Active B')
    await addTodo(page, 'Completed C')
    // Mark "Completed C" (index 0, newest) as completed
    await getTodoItems(page).nth(0).getByTestId('todo-item-complete-check').check()
  })

  test('All filter shows all todos', async ({ page }) => {
    // Navigate away then back to All
    await page.locator('[data-cy="active-filter"]').click()
    await page.locator('[data-cy="all-filter"]').click()
    await expect(page).toHaveURL('/')
    await expect(getTodoItems(page)).toHaveCount(3)
  })

  test('Active filter shows only uncompleted todos', async ({ page }) => {
    await page.locator('[data-cy="active-filter"]').click()
    await expect(page).toHaveURL('/active')
    const items = getTodoItems(page)
    await expect(items).toHaveCount(2)
    // All visible items should be active (not completed)
    for (let i = 0; i < 2; i++) {
      await expect(items.nth(i)).not.toHaveClass(/completed/)
    }
  })

  test('Completed filter shows only completed todos', async ({ page }) => {
    await page.locator('[data-cy="completed-filter"]').click()
    await expect(page).toHaveURL('/completed')
    const items = getTodoItems(page)
    await expect(items).toHaveCount(1)
    await expect(items.nth(0)).toHaveClass(/completed/)
  })

  test('Active filter hides completed todos', async ({ page }) => {
    await page.locator('[data-cy="active-filter"]').click()
    const texts = await page.locator('[data-testid="todo-body-text"]').allTextContents()
    expect(texts).not.toContain('Completed C')
    expect(texts).toContain('Active A')
    expect(texts).toContain('Active B')
  })

  test('Completed filter hides active todos', async ({ page }) => {
    await page.locator('[data-cy="completed-filter"]').click()
    const texts = await page.locator('[data-testid="todo-body-text"]').allTextContents()
    expect(texts).not.toContain('Active A')
    expect(texts).not.toContain('Active B')
    expect(texts).toContain('Completed C')
  })

  test('selected filter link has "selected" class', async ({ page }) => {
    // All filter selected by default
    await expect(page.locator('[data-cy="all-filter"]')).toHaveClass(/selected/)
    await expect(page.locator('[data-cy="active-filter"]')).not.toHaveClass(/selected/)
    await expect(page.locator('[data-cy="completed-filter"]')).not.toHaveClass(/selected/)

    await page.locator('[data-cy="active-filter"]').click()
    await expect(page.locator('[data-cy="active-filter"]')).toHaveClass(/selected/)
    await expect(page.locator('[data-cy="all-filter"]')).not.toHaveClass(/selected/)

    await page.locator('[data-cy="completed-filter"]').click()
    await expect(page.locator('[data-cy="completed-filter"]')).toHaveClass(/selected/)
    await expect(page.locator('[data-cy="active-filter"]')).not.toHaveClass(/selected/)
  })

  test('direct navigation to /active shows correct items', async ({ page }) => {
    await page.goto('/active')
    const items = getTodoItems(page)
    await expect(items).toHaveCount(2)
    const texts = await page.locator('[data-testid="todo-body-text"]').allTextContents()
    expect(texts).not.toContain('Completed C')
    expect(texts).toContain('Active A')
    expect(texts).toContain('Active B')
  })

  test('direct navigation to /completed shows correct items', async ({ page }) => {
    await page.goto('/completed')
    const items = getTodoItems(page)
    await expect(items).toHaveCount(1)
    await expect(items.first().getByTestId('todo-body-text')).toHaveText('Completed C')
  })

  test('counter always shows uncompleted count regardless of filter', async ({ page }) => {
    // 2 active, 1 completed → counter = 2
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
    await page.locator('[data-cy="active-filter"]').click()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
    await page.locator('[data-cy="completed-filter"]').click()
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('2')
  })
})

// ---------------------------------------------------------------------------
// Empty / Edge States
// ---------------------------------------------------------------------------

test.describe('Empty state', () => {
  test('footer is not visible when there are no todos', async ({ page }) => {
    await expect(page.locator('.footer')).not.toBeVisible()
  })

  test('todo list is not rendered when there are no todos', async ({ page }) => {
    await expect(page.locator('[data-testid="todo-list"]')).not.toBeVisible()
  })

  test('footer and list appear when first todo is added', async ({ page }) => {
    await expect(page.locator('.footer')).not.toBeVisible()
    await addTodo(page, 'First todo')
    await expect(page.locator('.footer')).toBeVisible()
    await expect(page.locator('[data-testid="todo-list"]')).toBeVisible()
  })

  test('footer and list disappear when last todo is deleted', async ({ page }) => {
    await addTodo(page, 'Only todo')
    await expect(page.locator('.footer')).toBeVisible()
    await deleteTodoItem(page, getTodoItems(page).first())
    await expect(page.locator('.footer')).not.toBeVisible()
    await expect(page.locator('[data-testid="todo-list"]')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

test.describe('Persistence', () => {
  test('todos persist after page reload', async ({ page }) => {
    await addTodo(page, 'Persist this')
    await addTodo(page, 'And this too')
    // List (newest first): "And this too"(0), "Persist this"(1)
    // Mark "And this too" as completed
    await getTodoItems(page).nth(0).getByTestId('todo-item-complete-check').check()
    await expect(getTodoItems(page)).toHaveCount(2)

    // Reload page
    await page.reload()
    await page.waitForSelector('[data-cy="new-todo-input-text"]')

    // Both todos should still be present
    await expect(getTodoItems(page)).toHaveCount(2)
    // Counter should reflect 1 remaining (1 completed, 1 active)
    await expect(page.locator('[data-cy="remaining-uncompleted-todo-count"]')).toHaveText('1')
    // "And this too" (index 0) should still be completed
    await expect(getTodoItems(page).nth(0)).toHaveClass(/completed/)
    // "Persist this" (index 1) should still be active
    await expect(getTodoItems(page).nth(1)).not.toHaveClass(/completed/)
  })

  test('completed state persists after reload', async ({ page }) => {
    await addTodo(page, 'Persist completed')
    const item = getTodoItems(page).first()
    await item.getByTestId('todo-item-complete-check').check()
    // Verify completed before reload
    await expect(item).toHaveClass(/completed/)
    // Reload
    await page.reload()
    await page.waitForSelector('[data-cy="new-todo-input-text"]')
    // Should still be completed
    await expect(getTodoItems(page).first()).toHaveClass(/completed/)
  })

  test('edited todo text persists after reload', async ({ page }) => {
    await addTodo(page, 'Before edit')
    const item = getTodoItems(page).first()
    await item.getByTestId('todo-body-text').dblclick()
    await item.getByTestId('todo-edit-input').fill('After edit')
    await item.getByTestId('todo-edit-input').press('Enter')
    await expect(item.getByTestId('todo-body-text')).toHaveText('After edit')
    // Reload
    await page.reload()
    await page.waitForSelector('[data-cy="new-todo-input-text"]')
    await expect(getTodoItems(page).first().getByTestId('todo-body-text')).toHaveText('After edit')
  })
})
