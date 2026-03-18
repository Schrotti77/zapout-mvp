import { test, expect, selectors } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');

    // Navigate to settings
    await loggedInPage.locator(selectors.navSettings).click();

    // Wait for settings to load
    await expect(loggedInPage.locator('text=/Settings|Einstellungen/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should display user account info', async ({ loggedInPage }) => {
    // Account section should be visible
    await expect(loggedInPage.locator('text=/Account|Konto/i')).toBeVisible();
  });

  test('should display Lightning node info', async ({ loggedInPage }) => {
    // Lightning section should be visible
    await expect(loggedInPage.locator('text=/Lightning|Node/i')).toBeVisible();
  });

  test('should display Cashu wallet info', async ({ loggedInPage }) => {
    // Cashu wallet section should be visible
    await expect(loggedInPage.locator('text=/Cashu|Wallet/i')).toBeVisible();
  });

  test('should show language switcher', async ({ loggedInPage }) => {
    // Language selector should be visible
    const langSelector = loggedInPage.locator(
      'select, button:has-text("Deutsch"), button:has-text("English")'
    );
    await expect(langSelector.first()).toBeVisible();
  });

  test('should switch language to English', async ({ loggedInPage }) => {
    // Look for language button
    const langButton = loggedInPage.locator('button:has-text("English")');
    if (await langButton.isVisible()) {
      await langButton.click();

      // UI should update to English
      await expect(loggedInPage.locator('text=/Settings/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show logout button', async ({ loggedInPage }) => {
    // Logout button should be visible
    await expect(loggedInPage.locator(selectors.logoutButton)).toBeVisible();
  });

  test('should logout and return to login', async ({ loggedInPage }) => {
    // Click logout
    await loggedInPage.locator(selectors.logoutButton).click();

    // Should show login screen
    await expect(loggedInPage.locator('h2:has-text("Anmelden|Login|Sign in")')).toBeVisible({
      timeout: 5000,
    });
  });
});
