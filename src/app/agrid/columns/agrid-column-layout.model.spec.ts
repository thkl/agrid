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

  it('doubles the control column width when configured for row marking', () => {
    const model = createModel(new AgridControl(), 48);

    expect(model.gridTemplateColumns()).toBe('48px 60px 100px 80px');
    expect(model.pinnedGridTemplateColumns()).toBe('48px');
    expect(model.pinnedPaneWidth()).toBe(48);
    expect(model.totalWidth()).toBe(288);
  });

  it('creates separate runs when the same header group is no longer contiguous', () => {
    const groupedColumns: ColDef[] = [
      { field: 'first', header: 'First', group: 'employee', width: 80 },
      { field: 'last', header: 'Last', group: 'employee', width: 80 },
      { field: 'email', header: 'Email', width: 120 },
    ];
    const control = new AgridControl({ columnOrder: ['first', 'email', 'last'] });
    const model = createModel(control, 24, groupedColumns, [
      { id: 'employee', label: 'Employee' },
    ]);

    expect(model.hasHeaderGroups()).toBe(true);
    expect(model.scrollableHeaderGroupRuns()).toEqual([
      { key: 'center:first', id: 'employee', label: 'Employee', fields: ['first'], span: 1 },
      { key: 'center:email', id: null, label: '', fields: ['email'], span: 1 },
      { key: 'center:last', id: 'employee', label: 'Employee', fields: ['last'], span: 1 },
    ]);
  });

  function createModel(
    control: AgridControl,
    controlColumnWidth = 24,
    modelColumns = columns,
    headerGroups: { id: string; label: string }[] = [],
  ): AgridColumnLayoutModel {
    return new AgridColumnLayoutModel({
      control: signal(control),
      colDefs: signal(modelColumns),
      headerGroups: signal(headerGroups),
      showControlColumn: signal(true),
      controlColumnWidth: signal(controlColumnWidth),
      getColumnWidth: col => col.width ?? 0,
      getColumnWidthToken: col => `${col.width}px`,
    });
  }
});
