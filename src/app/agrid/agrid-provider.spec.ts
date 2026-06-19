import { describe, expect, it } from 'vitest';
import { AgridControl } from './agrid-control';
import { AgridProvider } from './agrid-provider';

describe('AgridProvider runtime state ownership', () => {
  it('seeds runtime flags into the supplied control', () => {
    const control = new AgridControl();
    new AgridProvider({
      control,
      loading: true,
      readonly: true,
      autoAddRows: true,
    });

    expect(control.loading()).toBe(true);
    expect(control.readonly()).toBe(true);
    expect(control.autoAddRows()).toBe(true);
  });

  it('keeps deprecated provider aliases synchronized with control state', () => {
    const provider = new AgridProvider();

    provider.loading.set(true);
    provider.readonlyGrid.set(true);
    provider.autoAddRows.set(true);
    expect(provider.control.loading()).toBe(true);
    expect(provider.control.readonly()).toBe(true);
    expect(provider.control.autoAddRows()).toBe(true);

    provider.control.setLoading(false);
    provider.control.setReadonly(false);
    provider.control.setAutoAddRows(false);
    expect(provider.loading()).toBe(false);
    expect(provider.readonlyGrid()).toBe(false);
    expect(provider.autoAddRows()).toBe(false);
  });
});
