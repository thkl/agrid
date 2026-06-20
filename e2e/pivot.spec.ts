import { expect, test } from '@playwright/test';

test.describe('pivot demo', () => {
  test('renders the generated matrix and updates its aggregate interactively', async ({ page }) => {
    await page.goto('/#/pivot');

    await expect(page.getByRole('heading', { name: 'Revenue by region and quarter' })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
    await expect(page.getByRole('columnheader')).toHaveCount(5);
    const headers = page.locator('.ag-header-cell-label');
    await expect(headers.nth(0)).toContainText('Region');
    for (const [index, quarter] of ['Q1', 'Q2', 'Q3', 'Q4'].entries()) {
      await expect(headers.nth(index + 1)).toContainText(quarter);
      await expect(headers.nth(index + 1)).toContainText('Sum Revenue');
    }

    const firstQuarter = page.locator('agrid-cell[data-col-field="__agrid_pivot_0"]').first();
    const firstQuarterValue = firstQuarter.locator('.ag-cell-value');
    await expect(firstQuarterValue).toHaveText(/^\$/);
    const sumValue = await firstQuarterValue.textContent();

    await page.locator('agrid-sidebar').getByRole('button', { name: 'Pivot', exact: true }).click();
    const pivotSidebar = page.getByRole('region', { name: 'Pivot', exact: true });
    await expect(pivotSidebar).toBeVisible();
    await pivotSidebar.getByLabel('Q2').uncheck();
    await expect(page.locator('agrid-cell[data-col-field="__agrid_pivot_1"]')).toHaveCount(0);
    await pivotSidebar.getByLabel('Aggregate').selectOption('avg');
    await expect(firstQuarterValue).toHaveText(/^\$/);
    await expect(firstQuarterValue).not.toHaveText(sumValue ?? '');

    await pivotSidebar.getByLabel('Values').selectOption('units');
    await expect(firstQuarterValue).not.toHaveText(/^\$/);
  });
});
