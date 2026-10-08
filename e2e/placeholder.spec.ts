import { test, expect } from '@playwright/test';

test.describe('App Shell Placeholder', () => {
  test('loads / and expects the placeholder text', async ({ page }) => {
    await page.goto('/');
    const placeholder = page.locator('[data-testid="page-placeholder"]');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toHaveText('This section will be built in a later step.');
  });
});
