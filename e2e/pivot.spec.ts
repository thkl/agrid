import { expect, test } from '@playwright/test';

test.describe('pivot demo', () => {
  test('renders the generated matrix and updates its aggregate interactively', async ({ page }) => {
    await page.goto('/#/pivot');

    await expect(page.getByRole('heading', { name: 'Revenue by region and quarter' })).toBeVisible();
    await expect(page.getByRole('grid')).toHaveAttribute('aria-readonly', 'true');
    await expect(page.getByRole('columnheader')).toHaveCount(5);
    expect(await page.locator('.ag-header-cell-label').allTextContents()).toEqual([
      'Region', 'Q1', 'Q2', 'Q3', 'Q4',
    ]);

    const firstQuarter = page.locator('agrid-cell[data-col-field="__agrid_pivot_0"]').first();
    await expect(firstQuarter.locator('.ag-cell-value')).toHaveText('$96,300');

    await page.getByRole('button', { name: 'Pivot', exact: true }).click();
    const pivotSidebar = page.getByRole('region', { name: 'Pivot', exact: true });
    await expect(pivotSidebar).toBeVisible();
    await pivotSidebar.getByLabel('Q2').uncheck();
    await expect(page.locator('agrid-cell[data-col-field="__agrid_pivot_1"]')).toHaveCount(0);
    await pivotSidebar.getByLabel('Aggregate').selectOption('avg');
    await expect(firstQuarter.locator('.ag-cell-value')).toHaveText('$16,050');

    await pivotSidebar.getByLabel('Values').selectOption('units');
    await expect(firstQuarter.locator('.ag-cell-value')).toHaveText('14');
  });
});
