import { expect, test } from '@playwright/test';

test('loads the GitHub Pages dataset and requests new blocks while scrolling', async ({ page }) => {
  const datasetResponse = page.waitForResponse(response =>
    response.url().endsWith('/demo/server-side-orders.json')
  );

  await page.goto('/#/server-side-row-model');
  await expect(page.locator('agrid')).toBeVisible();
  await expect((await datasetResponse).status()).toBe(200);

  const requestLog = page.locator('aside article');
  await expect(requestLog.first()).toBeVisible();
  const initialRequests = await requestLog.count();

  await expect(page.locator('agrid-cell').first()).toContainText('ORD-000001');

  await page.getByRole('textbox', { name: 'Filter... Order' }).fill('000100');
  await expect.poll(() => requestLog.count()).toBeGreaterThan(initialRequests);
  await expect(page.locator('agrid-cell').first()).toContainText('ORD-000100');
  await expect(page.locator('aside')).toContainText('1 matching');

  await page.getByRole('textbox', { name: 'Filter... Order' }).fill('');
  await expect(page.locator('agrid-cell').first()).toContainText('ORD-000001');

  await page.getByRole('button', { name: 'Column menu: Amount' }).click();
  await page.getByRole('button', { name: /Sort descending/ }).click();
  await expect(page.locator('agrid-cell').first()).toContainText('ORD-001818');
  await expect(page.locator('aside')).toContainText('sort: amount desc');
  const requestsBeforeScroll = await requestLog.count();

  const viewport = page.locator('cdk-virtual-scroll-viewport.ag-body');
  await viewport.evaluate(element => {
    element.scrollTop = element.scrollHeight * 0.75;
  });

  await expect.poll(() => requestLog.count()).toBeGreaterThan(requestsBeforeScroll);
  await expect(page.locator('aside')).toContainText('returned');
});
