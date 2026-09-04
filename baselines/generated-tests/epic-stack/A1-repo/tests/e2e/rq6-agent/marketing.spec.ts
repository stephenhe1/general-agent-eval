import { test, expect } from '@playwright/test'

test.describe('Marketing / Public Pages', () => {
	test('home page loads with hero content', async ({ page }) => {
		await page.goto('/')
		await expect(page).toHaveTitle('Epic Notes')
		await expect(page.getByRole('heading', { name: 'The Epic Stack' })).toBeVisible()
		// Has The Epic Stack link
		await expect(page.getByRole('link', { name: 'The Epic Stack' })).toBeVisible()
	})

	test('home page has Log In link for unauthenticated users', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible()
	})

	test('about page loads with content', async ({ page }) => {
		await page.goto('/about')
		await expect(page).toHaveTitle('Epic Notes')
		await expect(page.locator('body')).toContainText('About page')
	})

	test('privacy policy page loads with content', async ({ page }) => {
		await page.goto('/privacy')
		await expect(page).toHaveTitle('Epic Notes')
		await expect(page.locator('body')).toContainText('Privacy')
	})

	test('terms of service page loads with content', async ({ page }) => {
		await page.goto('/tos')
		await expect(page).toHaveTitle('Epic Notes')
		await expect(page.locator('body')).toContainText('Terms of service')
	})

	test('support page loads with content', async ({ page }) => {
		await page.goto('/support')
		await expect(page).toHaveTitle('Epic Notes')
		await expect(page.locator('body')).toContainText('Support')
	})

	test('404 page shows for unknown route', async ({ page }) => {
		await page.goto('/this-route-does-not-exist-at-all-xyz')
		await expect(page.locator('body')).toContainText("We can't find this page")
	})

	test('robots.txt is served', async ({ request }) => {
		const response = await request.get('/robots.txt')
		expect(response.status()).toBe(200)
	})

	test('sitemap.xml is served', async ({ request }) => {
		const response = await request.get('/sitemap.xml')
		expect(response.status()).toBe(200)
	})

	test('health check endpoint returns ok', async ({ request }) => {
		const response = await request.get('/resources/healthcheck')
		expect(response.status()).toBe(200)
	})

	test('logo links to home page', async ({ page }) => {
		await page.goto('/about')
		// Logo has text "epic\nnotes" (two spans)
		await page.getByRole('link', { name: 'epic notes' }).first().click()
		await expect(page).toHaveURL('/')
	})
})
