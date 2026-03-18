import { test, expect } from './helpers';

test.describe('Merchant', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');

    // Navigate to merchant
    await loggedInPage.locator('button:has-text("Merchant")').click();

    // Wait for merchant screen to load
    await expect(loggedInPage.locator('text=/Merchant|Händler/i')).toBeVisible({ timeout: 5000 });
  });

  test('should display merchant screen', async ({ loggedInPage }) => {
    // Merchant title should be visible
    await expect(loggedInPage.locator('h1, h2').first()).toBeVisible();
  });

  test('should show quick payment request button', async ({ loggedInPage }) => {
    // Quick payment request button should be visible
    await expect(loggedInPage.locator('button:has-text("Zahlen anfordern")')).toBeVisible();
  });
});
