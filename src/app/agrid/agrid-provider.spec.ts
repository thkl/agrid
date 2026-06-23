import { describe, expect, it } from 'vitest';
import { AgridControl } from './agrid-control';
import { AgridProvider } from './agrid-provider';
import { AgridDataSource } from './agrid-datasource';
import { ColDef } from './agrid.types';

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

  it('retains pivot configuration and rejects incompatible row models', () => {
    const pivotConfig = {
      rowField: 'region',
      columnField: 'quarter',
      valueField: 'amount',
    } as const;
    const provider = new AgridProvider({
      datasource: new AgridDataSource([{ region: 'EU', quarter: 'Q1', amount: 3 }]),
      pivotConfig,
    });
    expect(provider.pivotConfig).toBe(pivotConfig);

    expect(() => new AgridProvider({
      pivotConfig,
      treeConfig: {
        getId: (row: any) => row.id,
        getParentId: (row: any) => row.parentId,
        treeField: 'region',
      },
    })).toThrowError(/mutually exclusive/);
  });

  it('saves and loads a JSON-safe grid settings object into a live provider', () => {
    type SettingsRow = { region: string; quarter: string; amount: number };
    const columns: ColDef<SettingsRow>[] = [
      { field: 'region', header: 'Region' },
      { field: 'quarter', header: 'Quarter' },
      { field: 'amount', header: 'Amount', type: 'number' as const },
    ];
    const source = new AgridProvider({
      columns,
      control: new AgridControl({
        columnWidths: { region: 180 },
        filters: {},
        hiddenColumns: ['__agrid_pivot_1'],
      }),
      pivotConfig: {
        rowField: 'region', columnField: 'quarter', valueField: 'amount', aggregate: 'avg',
      },
    });
    const serialized = JSON.parse(JSON.stringify(source.saveSettings()));
    const target = new AgridProvider({ columns });

    target.loadSettings(serialized);

    expect(target.pivotConfig).toEqual(source.pivotConfig);
    expect(target.control.columnWidths()).toEqual({ region: 180 });
    expect(target.control.hiddenColumns().has('__agrid_pivot_1')).toBe(true);
    expect(target.saveSettings()).toEqual(serialized);
  });

  it('rejects settings that cannot be safely restored', () => {
    const provider = new AgridProvider({
      columns: [
        { field: 'region', header: 'Region' },
        { field: 'quarter', header: 'Quarter' },
        { field: 'amount', header: 'Amount' },
      ],
      pivotConfig: {
        rowField: 'region',
        columnField: 'quarter',
        valueField: 'amount',
        aggregate: values => values.length,
      },
    });
    expect(() => provider.saveSettings()).toThrowError(/cannot be saved/);

    expect(() => provider.loadSettings({
      version: 1,
      control: { columnWidths: {}, filters: {} },
      pivotConfig: {
        rowField: 'missing', columnField: 'quarter', valueField: 'amount', aggregate: 'sum',
      },
    })).toThrowError(/not configured/);
  });
});

describe('AgridProvider export bridge', () => {
  it('is a no-op before a grid attaches its export bridge', () => {
    const provider = new AgridProvider({ columns: [{ field: 'a', header: 'A' }] });
    expect(() => provider.exportCsv()).not.toThrow();
    expect(() => provider.exportXlsx()).not.toThrow();
  });

  it('delegates to the attached bridge with the resolved filename, and detaches on null', () => {
    const provider = new AgridProvider({ columns: [{ field: 'a', header: 'A' }] });
    const csv: string[] = [];
    const xlsx: string[] = [];
    provider.ɵattachExport({ csv: f => csv.push(f), xlsx: f => xlsx.push(f) });

    provider.exportCsv();
    provider.exportXlsx('report.xlsx');
    expect(csv).toEqual(['export.csv']); // default filename
    expect(xlsx).toEqual(['report.xlsx']);

    provider.ɵattachExport(null);
    provider.exportCsv();
    expect(csv).toEqual(['export.csv']); // unchanged after detach
  });
});
