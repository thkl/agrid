import { describe, expect, it, vi } from 'vitest';
import { AgridBrowserAdapter } from './agrid-browser.adapter';

describe('AgridBrowserAdapter', () => {
  it('fails browser-only operations safely without browser globals', async () => {
    const adapter = new AgridBrowserAdapter(null, null);

    expect(adapter.available).toBe(false);
    expect(await adapter.writeClipboard('value')).toBe(false);
    expect(adapter.downloadText('grid.csv', 'a,b', 'text/csv')).toBe(false);
    expect(adapter.elementsFromPoint(0, 0)).toEqual([]);
  });

  it('absorbs rejected clipboard writes', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const adapter = new AgridBrowserAdapter(
      document,
      { navigator: { clipboard: { writeText } } } as unknown as Window,
    );

    expect(await adapter.writeClipboard('value')).toBe(false);
  });
});
