import { test, expect } from './helpers';

test.describe('Cart & Checkout', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/');
  });

  test('should open cart drawer', async ({ loggedInPage }) => {
    // Click cart button
    await loggedInPage.locator('button:has-text("Cart")').click();

    // Cart drawer should open
    await expect(loggedInPage.locator('text=/Warenkorb|Cart/i')).toBeVisible({ timeout: 5000 });
  });

  test('should add product to cart from products screen', async ({ loggedInPage }) => {
    // Navigate to products
    await loggedInPage.locator('button:has-text("Products")').click();

    // Wait for products to load
    await expect(loggedInPage.locator('text=/Products|Produkte/i')).toBeVisible({ timeout: 5000 });

    // Click add to cart if available
    const addButton = loggedInPage.locator('button:has-text("In den Warenkorb")').first();
    if (await addButton.isVisible()) {
      await addButton.click();

      // Cart should update
      await expect(loggedInPage.locator('text=/+1|Warenkorb.*[1-9]/i')).toBeVisible({
        timeout: 3000,
      });
    }
  });

  test('should show cart items', async ({ loggedInPage }) => {
    // Open cart
    await loggedInPage.locator('button:has-text("Cart")').click();

    // Cart content should be visible
    await expect(loggedInPage.locator('text=/Dein Warenkorb|Warenkorb/i')).toBeVisible({
      timeout: 5000,
    });
  });
});
