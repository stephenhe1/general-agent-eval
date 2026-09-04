import { test, expect } from '@playwright/test'
import { loginAsKody } from './helpers'

test.describe('Admin Cache (kody has admin role)', () => {
	test.slow() // Login can be slow

	test.beforeEach(async ({ page }) => {
		await loginAsKody(page)
	})

	test('admin cache page loads for admin user', async ({ page }) => {
		await page.goto('/admin/cache')
		await expect(page).toHaveURL(/\/admin\/cache/)
		await expect(page.locator('body')).toContainText(/cache/i)
	})

	test('admin cache page shows SQLite or LRU cache sections', async ({
		page,
	}) => {
		await page.goto('/admin/cache')
		await page.waitForLoadState('networkidle')
		const body = page.locator('body')
		await expect(body).toContainText(/sqlite|lru/i)
	})

	test('admin cache page has accessible content', async ({ page }) => {
		await page.goto('/admin/cache')
		await page.waitForLoadState('networkidle')
		// Page loaded correctly
		await expect(page).toHaveURL(/\/admin\/cache/)
		await expect(page.locator('body')).toBeVisible()
	})
})

test.describe('Admin - access control', () => {
	test('admin cache redirects unauthenticated user to login', async ({
		page,
	}) => {
		await page.goto('/admin/cache')
		await expect(page).toHaveURL(/\/login/)
	})
})
