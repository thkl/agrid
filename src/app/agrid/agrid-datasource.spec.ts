import { signal } from '@angular/core';
import { AgridDataSource } from './agrid-datasource';

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
