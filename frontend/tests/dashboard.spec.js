import { test, expect, selectors } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');
    // Wait for dashboard to load
    await expect(loggedInPage.locator('text=Zahlen')).toBeVisible({ timeout: 5000 });
  });

  test('should display balance', async ({ loggedInPage }) => {
    // Balance should be visible
    await expect(loggedInPage.locator('text=Balance')).toBeVisible();
    await expect(loggedInPage.locator('text=sats')).toBeVisible();
  });

  test('should show quick amount buttons', async ({ loggedInPage }) => {
    // Quick amount buttons should be visible
    await expect(loggedInPage.getByRole('button', { name: /100/i })).toBeVisible();
    await expect(loggedInPage.getByRole('button', { name: /500/i })).toBeVisible();
    await expect(loggedInPage.getByRole('button', { name: /1000/i })).toBeVisible();
  });

  test('should open payment modal on quick amount click', async ({ loggedInPage }) => {
    // Click 100 sats button
    await loggedInPage.getByRole('button', { name: /100/i }).first().click();

    // Payment modal should open
    await expect(loggedInPage.locator('text=/Lightning Invoice|bezahlen/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should open payment modal on custom amount', async ({ loggedInPage }) => {
    // Enter custom amount
    await loggedInPage.locator(selectors.amountInput).fill('250');
    await loggedInPage.locator(selectors.payButton).click();

    // Payment modal should open
    await expect(loggedInPage.locator('text=/Lightning Invoice|bezahlen/i')).toBeVisible({
      timeout: 5000,
    });
  });
});
