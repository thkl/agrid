import { signal } from '@angular/core';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';

describe('AgridDataSource linked signal', () => {
  it('uses external signal values without copying the array', () => {
    const first = [{ id: 1, name: 'Alice' }];
    const source = signal(first);
    const datasource = new AgridDataSource<{ id: number; name: string }>();

    datasource.linkSignal(source);

    expect(datasource.rows()).toBe(first);

    const second = [{ id: 2, name: 'Bob' }];
    source.set(second);

    expect(datasource.rows()).toBe(second);
  });

  it('writes datasource mutations back to a writable source signal', () => {
    const source = signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    const datasource = new AgridDataSource<{ id: number; name: string }>();
    datasource.linkSignal(source);

    datasource.patchRow(0, { name: 'Edited' });
    datasource.addRow({ id: 3, name: 'Carol' });
    datasource.removeRow(1);

    expect(datasource.getRow(0).name).toBe('Edited');
    expect(source()).toEqual([
      { id: 1, name: 'Edited' },
      { id: 3, name: 'Carol' },
    ]);
    expect(datasource.rows()).toBe(source());
  });

  it('keeps datasource edits local for a readonly source signal', () => {
    const writableSource = signal([{ id: 1, name: 'Alice' }]);
    const readonlySource = writableSource.asReadonly();
    const datasource = new AgridDataSource<{ id: number; name: string }>();
    datasource.linkSignal(readonlySource);

    datasource.patchRow(0, { name: 'Edited' });

    expect(datasource.getRow(0).name).toBe('Edited');
    expect(writableSource()[0].name).toBe('Alice');

    writableSource.set([{ id: 1, name: 'Reloaded' }]);

    expect(datasource.getRow(0).name).toBe('Reloaded');
  });
});

describe('AgridDataSource transactions', () => {
  interface Row {
    id: number;
    name: string;
    status: 'new' | 'active' | 'closed';
    amount: number;
  }

  const rows = (): Row[] => [
    { id: 1, name: 'Alpha', status: 'new', amount: 120 },
    { id: 2, name: 'Beta', status: 'active', amount: 260 },
    { id: 3, name: 'Gamma', status: 'closed', amount: 90 },
  ];

  it('applies add, update, and remove operations in one transaction', () => {
    const datasource = new AgridDataSource<Row>(rows(), row => row.id);

    const result = datasource.applyTransaction({
      update: [{ id: 2, changes: { status: 'closed', amount: 300 } }],
      remove: [1],
      add: [{ id: 4, name: 'Delta', status: 'new', amount: 75 }],
      addIndex: 1,
    });

    expect(datasource.rows()).toEqual([
      { id: 2, name: 'Beta', status: 'closed', amount: 300 },
      { id: 4, name: 'Delta', status: 'new', amount: 75 },
      { id: 3, name: 'Gamma', status: 'closed', amount: 90 },
    ]);
    expect(result.added).toEqual([{ id: 4, name: 'Delta', status: 'new', amount: 75 }]);
    expect(result.updated).toEqual([
      { id: 2, name: 'Beta', status: 'closed', amount: 300 },
    ]);
    expect(result.removed).toEqual([{ id: 1, name: 'Alpha', status: 'new', amount: 120 }]);
    expect(result.addIndexes).toEqual([1]);
    expect(result.updateIndexes).toEqual([1]);
    expect(result.removeIndexes).toEqual([0]);
  });

  it('matches complete replacement-shaped updates with getRowId and returns complete records', () => {
    const datasource = new AgridDataSource<Row>(rows(), row => row.id);

    const result = datasource.applyTransaction({
      update: [{ id: 3, name: 'Gamma Ltd', status: 'active', amount: 115 }],
    });

    expect(datasource.getRow(2)).toEqual({
      id: 3,
      name: 'Gamma Ltd',
      status: 'active',
      amount: 115,
    });
    expect(result.updated).toEqual([
      { id: 3, name: 'Gamma Ltd', status: 'active', amount: 115 },
    ]);
  });

  it('supports index-based updates and removals without row ids', () => {
    const datasource = new AgridDataSource<Row>(rows());

    const result = datasource.applyTransaction({
      update: [{ index: 0, changes: { amount: 140 } }],
      remove: [{ index: 2 }],
    });

    expect(datasource.rows()).toEqual([
      { id: 1, name: 'Alpha', status: 'new', amount: 140 },
      { id: 2, name: 'Beta', status: 'active', amount: 260 },
    ]);
    expect(result.updated).toEqual([
      { id: 1, name: 'Alpha', status: 'new', amount: 140 },
    ]);
    expect(result.removed).toEqual([
      { id: 3, name: 'Gamma', status: 'closed', amount: 90 },
    ]);
  });

  it('uses the provider getRowId for datasource transactions', () => {
    const datasource = new AgridDataSource<Row>(rows());
    new AgridProvider<Row>({
      datasource,
      getRowId: row => row.id,
    });

    const result = datasource.applyTransaction({
      update: [{ id: 2, changes: { name: 'Beta Inc' } }],
    });

    expect(datasource.getRow(1).name).toBe('Beta Inc');
    expect(result.updated).toEqual([
      { id: 2, name: 'Beta Inc', status: 'active', amount: 260 },
    ]);
  });
});
