import { expect, test } from '@playwright/test';

const ROW_COUNTS = [10_000, 50_000, 100_000,250_000];
const OPERATIONS = [
  'filter',
  'clear',
  'sort',
  'multi-sort',
  'group',
  'expand-groups',
  'aggregate',
  'update-row',
] as const;

test.describe('@performance large datasets', () => {
  test.describe.configure({ mode: 'serial' });

  for (const rowCount of ROW_COUNTS) {
    test(`${rowCount.toLocaleString()} rows`, async ({ page }, testInfo) => {
      const status = page.getByTestId('benchmark-status');
      const navigationStartedAt = Date.now();

      await page.goto(`/performance?rows=${rowCount}`);
      await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });

      const results: Record<string, number> = {
        'page-ready': Date.now() - navigationStartedAt,
        'initial-render': Number(await status.getAttribute('data-duration-ms')),
      };

      for (const operation of OPERATIONS) {
        const previousSequence = await status.getAttribute('data-sequence');
        await page.getByTestId(operation).click();
        await expect(status).not.toHaveAttribute('data-sequence', previousSequence ?? '', {
          timeout: 60_000,
        });
        results[operation] = Number(await status.getAttribute('data-duration-ms'));

        if (operation === 'sort') {
          const menuStartedAt = Date.now();
          await page.locator('[data-col-field="salary"] .ag-header-menu-btn').click();
          await expect(page.locator('.ag-filter-menu')).toBeVisible();
          results['sorted-column-menu'] = Date.now() - menuStartedAt;
          await page.locator('.ag-wrapper').click({ position: { x: 5, y: 5 } });
          await expect(page.locator('.ag-filter-menu')).toBeHidden();
        }
      }

      const viewport = page.locator('.ag-horizontal-scroll cdk-virtual-scroll-viewport').first();
      results['scroll-to-end'] = await viewport.evaluate(async element => {
        const startedAt = performance.now();
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event('scroll'));
        await new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return Math.round((performance.now() - startedAt) * 100) / 100;
      });

      testInfo.annotations.push({
        type: 'performance',
        description: JSON.stringify({ rowCount, unit: 'ms', results }),
      });
      console.log(`[performance] ${rowCount} rows ${JSON.stringify(results)}`);
    });
  }
});
