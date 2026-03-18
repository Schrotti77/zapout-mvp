import { test, expect } from '@playwright/test';

test.describe('App Load', () => {
  test('should load frontend', async ({ page, baseURL }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('domcontentloaded');
    // Just check page has content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
