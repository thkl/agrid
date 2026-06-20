import { expect, test } from '@playwright/test';

test.describe('task-oriented documentation', () => {
  test('navigates functional chapters without leaving the hash-routed docs page', async ({ page }) => {
    await page.goto('/#/documentation');

    await expect(page.getByRole('heading', { name: 'Start with what you want to build' })).toBeVisible();
    await expect(page.locator('.guide-card-grid a')).toHaveCount(9);
    await expect(page.getByRole('heading', { name: 'How to sort and filter rows' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'How to build a pivot table' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'How to save and restore user settings' })).toBeAttached();

    await page.locator('.docs-toc').getByRole('link', { name: 'Build a pivot' }).click();

    await expect(page).toHaveURL(/#\/documentation$/);
    await expect(page.getByRole('heading', { name: 'How to build a pivot table' })).toBeInViewport();
    await expect(page.getByRole('link', { name: /Open the live pivot demo/ })).toBeVisible();
  });
});
