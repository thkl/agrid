import { expect, test } from '@playwright/test';

const cell = (row: number, col: number) =>
  `agrid-cell[data-cell-row="${row}"][data-cell-col="${col}"]`;

test.describe('agrid browser interactions', () => {
  test('opens the published documentation from the application navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Documentation', exact: true }).first().click();

    await expect(page).toHaveURL(/\/documentation$/);
    await expect(page.getByRole('heading', { name: 'agrid documentation' })).toBeVisible();
    await expect(page.getByText('pnpm add @thkl/agrid @angular/cdk')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AgridProvider' })).toBeVisible();
  });

  test('supports keyboard editing and navigation', async ({ page }) => {
    await page.goto('/demo');
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

  test('keeps typing in header filters instead of reopening the selected cell editor', async ({ page }) => {
    await page.goto('/demo');
    const selectedCell = page.locator(cell(0, 1)).first();
    await selectedCell.click();

    const headerFilter = page.locator(
      '.ag-header-cell[data-col-field="firstName"] .ag-filter-input',
    );
    await headerFilter.click();
    await headerFilter.pressSequentially('Al');

    await expect(headerFilter).toHaveValue('Al');
    await expect(page.locator('.ag-cell-input')).toHaveCount(0);
    await expect(selectedCell).not.toHaveAttribute('aria-selected', 'true');

    await headerFilter.fill('');
    await page.locator(
      '.ag-header-cell[data-col-field="firstName"] .ag-header-menu-btn',
    ).click();
    const menuFilter = page.locator('.ag-filter-menu-search');
    await menuFilter.click();
    await menuFilter.pressSequentially('Bo');

    await expect(menuFilter).toHaveValue('Bo');
    await expect(page.locator('.ag-cell-input')).toHaveCount(0);
  });

  test('edits date columns with a native date input', async ({ page }) => {
    await page.goto('/demo');
    const grid = page.getByRole('grid');
    const hiredAt = page.locator(cell(0, 5)).first();

    await hiredAt.click();
    await grid.press('Enter');
    const editor = hiredAt.locator('input[type="date"]');
    await expect(editor).toHaveValue('2017-12-31');
    await editor.fill('2020-05-20');
    await editor.press('Enter');

    await expect(page.locator('.edit-log')).toContainText('2020-05-20T');
    await expect(hiredAt.locator('.ag-cell-value')).toContainText('May');
  });

  test('copies and pastes a selected cell through browser clipboard events', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/demo');
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

  test('confirms row deletion inside the faded target row', async ({ page }) => {
    await page.goto('/demo');
    const firstControlCell = page.locator(
      '.ag-pinned-pane:not(.ag-pinned-pane--right) .ag-control-cell',
    ).first();
    const firstName = page.locator(cell(0, 1)).first();

    await expect(firstName.locator('.ag-cell-value')).toHaveText('Alice');
    await firstControlCell.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete row' }).click();

    const pendingRow = page.locator('.ag-scroll-pane .ag-row--pending-delete');
    const confirmation = pendingRow.locator('.ag-delete-confirmation');
    await expect(confirmation).toContainText('Sure to delete?');
    await expect(firstName).toHaveCSS('opacity', '0.2');

    await confirmation.getByRole('button', { name: 'No' }).click();
    await expect(pendingRow).toHaveCount(0);
    await expect(firstName.locator('.ag-cell-value')).toHaveText('Alice');

    await firstControlCell.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete row' }).click();
    await page.locator('.ag-delete-confirmation').getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator(cell(0, 1)).first().locator('.ag-cell-value')).toHaveText('Bob');
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
      '.ag-pinned-pane:not(.ag-pinned-pane--right) .ag-header-cell[data-col-field="id"]',
    );
    const rightHeader = page.locator(
      '.ag-pinned-pane--right .ag-header-cell[data-col-field="status"]',
    );
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
    const nameCell = page.locator('.ag-horizontal-scroll agrid-cell[data-col-field="name"]').first();
    const emailCell = page.locator('.ag-horizontal-scroll agrid-cell[data-col-field="email"]').first();

    const nameBox = await nameHeader.boundingBox();
    const emailBox = await emailHeader.boundingBox();
    if (!nameBox || !emailBox) throw new Error('Column headers are not visible');

    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(emailBox.x + emailBox.width - 4, emailBox.y + emailBox.height / 2, {
      steps: 8,
    });

    const preview = page.locator('.ag-column-drag-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Name');
    await expect(nameHeader).toHaveCSS('opacity', '0.12');
    await expect.poll(async () => emailHeader.evaluate(element =>
      getComputedStyle(element).transform,
    )).not.toBe('none');
    await expect(nameCell).toHaveCSS('opacity', '0.12');
    await expect.poll(async () => emailCell.evaluate(element =>
      getComputedStyle(element).transform,
    )).not.toBe('none');

    await page.mouse.move(emailBox.x + emailBox.width - 4, emailBox.y + emailBox.height + 80);
    await expect(preview).toBeVisible();
    await expect.poll(async () => emailCell.evaluate(element =>
      getComputedStyle(element).transform,
    )).not.toBe('none');

    await page.mouse.up();
    await expect(preview).toHaveCount(0);

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
