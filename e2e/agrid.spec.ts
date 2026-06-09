import { expect, test } from '@playwright/test';

const cell = (row: number, col: number) =>
  `agrid-cell[data-cell-row="${row}"][data-cell-col="${col}"]`;

test.describe('agrid browser interactions', () => {
  test('supports keyboard editing and navigation', async ({ page }) => {
    await page.goto('/');
    const grid = page.getByRole('grid');
    const firstName = page.locator(cell(0, 1)).first();

    await firstName.click();
    await grid.press('Enter');
    const editor = firstName.locator('.ag-cell-input');
    await expect(editor).toBeVisible();
    await editor.fill('Alicia');
    await editor.press('Tab');

    await expect(firstName.locator('.ag-cell-value')).toHaveText('Alicia');
    await expect(page.locator(cell(0, 2)).first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.edit-log')).toContainText('"firstName": "Alice" → "Alicia"');
  });

  test('copies and pastes a selected cell through browser clipboard events', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const grid = page.getByRole('grid');
    const source = page.locator(cell(0, 1)).first();
    const target = page.locator(cell(1, 1)).first();

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await source.click();
    await grid.press(`${modifier}+C`);
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Alice');
    await page.evaluate(() => navigator.clipboard.writeText('Copied value'));
    await target.click();
    await grid.press(`${modifier}+V`);

    await expect(target.locator('.ag-cell-value')).toHaveText('Copied value');
  });

  test('exposes coherent grid accessibility state', async ({ page }) => {
    await page.goto('/readonly');
    const grid = page.getByRole('grid');

    await expect(grid).toHaveAttribute('aria-label', 'Data grid');
    await expect(grid).toHaveAttribute('aria-readonly', 'true');
    await expect(grid).toHaveAttribute('aria-rowcount', /\d+/);
    await expect(grid).toHaveAttribute('aria-colcount', '8');
    await expect(page.getByRole('columnheader', { name: /Key/ })).toBeVisible();

    await page.getByLabel('Allow editing').check();
    await expect(grid).not.toHaveAttribute('aria-readonly', 'true');
  });

  test('navigates client-side pages with labelled controls', async ({ page }) => {
    await page.goto('/pagination');
    const pageInfo = page.locator('.ag-page-info');

    await expect(pageInfo).toHaveText('1 / 20');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(pageInfo).toHaveText('2 / 20');
    await expect(page.getByRole('row', { name: /^26 / })).toBeVisible();
    await page.getByRole('button', { name: 'First page' }).click();
    await expect(pageInfo).toHaveText('1 / 20');
  });

  test('keeps left and right pinned columns fixed during horizontal scrolling', async ({ page }) => {
    await page.goto('/pinning');
    const leftHeader = page.locator(
      '.ag-pinned-pane:not(.ag-pinned-pane--right) [data-col-field="id"]',
    );
    const rightHeader = page.locator('.ag-pinned-pane--right [data-col-field="status"]');
    const scroller = page.locator('.ag-horizontal-scroll');

    const leftBefore = await leftHeader.boundingBox();
    const rightBefore = await rightHeader.boundingBox();
    await scroller.evaluate(element => {
      element.scrollLeft = element.scrollWidth;
      element.dispatchEvent(new Event('scroll'));
    });

    await expect.poll(async () => (await scroller.evaluate(element => element.scrollLeft))).toBeGreaterThan(0);
    expect((await leftHeader.boundingBox())?.x).toBe(leftBefore?.x);
    expect((await rightHeader.boundingBox())?.x).toBe(rightBefore?.x);
  });

  test('reorders unlocked columns by dragging their headers', async ({ page }) => {
    await page.goto('/pinning');
    const nameHeader = page.locator('.ag-horizontal-scroll > .ag-header [data-col-field="name"]');
    const emailHeader = page.locator('.ag-horizontal-scroll > .ag-header [data-col-field="email"]');

    const nameBox = await nameHeader.boundingBox();
    const emailBox = await emailHeader.boundingBox();
    if (!nameBox || !emailBox) throw new Error('Column headers are not visible');

    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(emailBox.x + emailBox.width - 4, emailBox.y + emailBox.height / 2, {
      steps: 8,
    });
    await page.mouse.up();

    const headers = page.locator(
      '.ag-horizontal-scroll > .ag-header > .ag-header-cell[data-col-field]',
    );
    await expect.poll(async () => {
      const fields = await headers.evaluateAll(elements =>
        elements.map(element => (element as HTMLElement).dataset['colField']),
      );
      return fields.indexOf('name') > fields.indexOf('email');
    }).toBe(true);
  });
});
