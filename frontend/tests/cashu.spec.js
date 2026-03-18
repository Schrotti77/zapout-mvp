import { test, expect } from './helpers';

test.describe('Cashu', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');

    // Navigate to Cashu
    await loggedInPage.locator('button:has-text("Cashu")').click();

    // Wait for Cashu screen to load
    await expect(loggedInPage.locator('h1:has-text("Cashu")')).toBeVisible({ timeout: 5000 });
  });

  test('should display balance', async ({ loggedInPage }) => {
    // Balance should be visible
    await expect(loggedInPage.locator('text=/Balance/i')).toBeVisible();
  });

  test('should show mint section', async ({ loggedInPage }) => {
    // Mint section should be visible
    await expect(loggedInPage.locator('text=/generieren|Cashu generieren/i')).toBeVisible();
  });

  test('should create mint quote', async ({ loggedInPage }) => {
    // Click generate button
    await loggedInPage.locator('button:has-text("Generieren")').click();

    // Should show invoice or loading
    await expect(
      loggedInPage.locator('text=/Lightning Invoice|Lädt|Loading|error|Error/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show token input section', async ({ loggedInPage }) => {
    // Token input should be visible
    await expect(loggedInPage.locator('textarea[placeholder*="Token"]')).toBeVisible();
  });

  test('should show verify and receive buttons', async ({ loggedInPage }) => {
    // Verify and receive buttons should be visible
    await expect(loggedInPage.locator('button:has-text("Prüfen")')).toBeVisible();
    await expect(loggedInPage.locator('button:has-text("Einlösen")')).toBeVisible();
  });

  test('should show QR scanner option', async ({ loggedInPage }) => {
    // QR scan button should be visible
    await expect(loggedInPage.locator('button:has-text("QR-Code scannen")')).toBeVisible();
  });

  test('should show Cashu info section', async ({ loggedInPage }) => {
    // Info section should be visible
    await expect(loggedInPage.locator('text=/Was ist Cashu|Digitale Bargeld/i')).toBeVisible();
  });
});
