import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from '../agrid-control';
import { ColDef } from '../agrid.types';
import { AgridColumnLayoutModel } from './agrid-column-layout.model';

describe('AgridColumnLayoutModel', () => {
  const columns: ColDef[] = [
    { field: 'id', header: 'ID', width: 60 },
    { field: 'name', header: 'Name', width: 100, filterable: true },
    { field: 'status', header: 'Status', width: 80 },
  ];

  it('applies visibility, order, pinning, and pane dimensions', () => {
    const control = new AgridControl({
      hiddenColumns: ['status'],
      columnOrder: ['name', 'id', 'status'],
      pinnedColumns: ['id'],
    });
    const model = createModel(control);

    expect(model.visibleColDefs().map(col => col.field)).toEqual(['id', 'name']);
    expect(model.pinnedColDefs().map(col => col.field)).toEqual(['id']);
    expect(model.scrollableColDefs().map(col => col.field)).toEqual(['name']);
    expect(model.pinnedPaneWidth()).toBe(84);
    expect(model.scrollableTotalWidth()).toBe(100);
    expect(model.hasFilterableColumns()).toBe(true);
  });

  it('supports right-pinned columns and grid width tokens', () => {
    const control = new AgridControl({ pinnedRightColumns: ['status'] });
    const model = createModel(control);

    expect(model.rightPinnedColDefs().map(col => col.field)).toEqual(['status']);
    expect(model.rightGridTemplateColumns()).toBe('80px');
    expect(model.gridTemplateColumns()).toBe('24px 60px 100px 80px');
    expect(model.totalWidth()).toBe(264);
  });

  function createModel(control: AgridControl): AgridColumnLayoutModel {
    return new AgridColumnLayoutModel({
      control: signal(control),
      colDefs: signal(columns),
      showControlColumn: signal(true),
      getColumnWidth: col => col.width ?? 0,
      getColumnWidthToken: col => `${col.width}px`,
    });
  }
});
