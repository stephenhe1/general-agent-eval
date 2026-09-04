import { test, expect } from '@playwright/test'
import { loginAsKody, KODY_USERNAME } from './helpers'

test.describe('Navigation - Public', () => {
	test('logo link navigates to home from any page', async ({ page }) => {
		await page.goto('/about')
		await page.waitForLoadState('networkidle')
		// Logo is a link with text "epic notes"
		await page.getByRole('link', { name: 'epic notes' }).first().click()
		await expect(page).toHaveURL('/')
	})

	test('header search bar is visible on public pages', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await expect(page.locator('input[name="search"]').first()).toBeVisible()
	})

	test('header search navigates to users page with query', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		const searchInput = page.locator('input[name="search"]').first()
		await searchInput.fill('kody')
		await page.locator('button[type="submit"]').first().click()
		await page.waitForURL(/\/users/)
		await expect(page).toHaveURL(/\/users/)
	})

	test('unauthenticated header shows Log In link', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		// Log In is a link (rendered as <a> with Button styling)
		const logInLink = page.getByRole('link', { name: 'Log In' })
		await expect(logInLink).toBeVisible()
	})

	test('footer logo also links to home', async ({ page }) => {
		await page.goto('/users')
		await page.waitForLoadState('networkidle')
		// Footer also has the logo link - use last() to get footer one
		await page.getByRole('link', { name: 'epic notes' }).last().click()
		await expect(page).toHaveURL('/')
	})
})

test.describe('Navigation - Authenticated', () => {
	test.slow() // Login can be slow

	test('authenticated header hides Log In and shows user menu', async ({
		page,
	}) => {
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		// Log In link should not be visible when logged in
		await expect(page.getByRole('link', { name: 'Log In' })).not.toBeVisible()
		// User menu should be visible
		await expect(page.getByRole('link', { name: 'User menu' })).toBeVisible()
	})

	test('user dropdown shows Profile, Notes, and Logout items', async ({
		page,
	}) => {
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await page.getByRole('link', { name: 'User menu' }).click()
		await expect(
			page.getByRole('menuitem', { name: /Profile/i }),
		).toBeVisible()
		await expect(page.getByRole('menuitem', { name: /Notes/i })).toBeVisible()
		await expect(
			page.getByRole('menuitem', { name: /Logout/i }),
		).toBeVisible()
	})

	test('user dropdown Profile link navigates to user profile', async ({
		page,
	}) => {
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await page.getByRole('link', { name: 'User menu' }).click()
		await page.getByRole('menuitem', { name: /Profile/i }).click()
		await expect(page).toHaveURL(new RegExp(`/users/${KODY_USERNAME}`))
	})

	test('user dropdown Notes link navigates to user notes', async ({ page }) => {
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await page.getByRole('link', { name: 'User menu' }).click()
		await page.getByRole('menuitem', { name: /Notes/i }).click()
		await expect(page).toHaveURL(new RegExp(`/users/${KODY_USERNAME}/notes`))
	})

	test('logout from dropdown returns to public state', async ({ page }) => {
		await loginAsKody(page)
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await page.getByRole('link', { name: 'User menu' }).click()
		await page.getByRole('menuitem', { name: /Logout/i }).click()
		// After logout, Log In link should appear again
		await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible()
	})
})

test.describe('Navigation - Theme Switch', () => {
	test('theme switch button cycles the theme mode', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')

		// Find the theme switch button (it shows current mode: System/Light/Dark)
		const themeButton = page
			.getByRole('button', { name: /System|Light|Dark/i })
			.last()
		await expect(themeButton).toBeVisible()

		// Get the current button text (current mode)
		const initialText = await themeButton.innerText()

		// Use dispatchEvent to bypass React Router devtools overlay
		await themeButton.dispatchEvent('click')
		await page.waitForTimeout(500)

		// The theme switch submits a form - wait for it to process
		await page.waitForLoadState('networkidle')

		// Get the new button text - it should have changed to next mode
		const newText = await themeButton.innerText()
		// The mode label should have changed (System -> Light -> Dark -> System)
		expect(newText.trim()).not.toBe(initialText.trim())
	})
})
