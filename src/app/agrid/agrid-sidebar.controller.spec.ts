import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridSidebarController } from './agrid-sidebar.controller';
import { GridEditEvent } from './agrid.types';

describe('AgridSidebarController', () => {
  it('commits typed detail edits and pushes history', () => {
    const control = new AgridControl();
    const dataSource = new AgridDataSource([{ amount: 1 }]);
    const events: GridEditEvent[] = [];
    const controller = new AgridSidebarController({
      control: signal(control),
      dataSource: signal(dataSource),
      colDefs: signal([{ field: 'amount', header: 'Amount', type: 'number' }]),
      visibleColDefs: signal([{ field: 'amount', header: 'Amount', type: 'number' }]),
      selectedRowIndex: signal(0),
      autoOpenDetail: signal(false),
      useSidebarEditor: signal(false),
      onCellEdit: event => events.push(event),
    });

    controller.commitEdit('amount', { field: 'amount', header: 'Amount', type: 'number' }, '12');

    expect(dataSource.getRow(0)['amount']).toBe(12);
    expect(control.canUndo()).toBe(true);
    expect(events[0].newValue).toBe(12);
  });

  it('preserves an ISO date time suffix when editing a date field', () => {
    const dataSource = new AgridDataSource([
      { hiredAt: '2024-03-15T14:30:00.000Z' },
    ]);
    const controller = new AgridSidebarController({
      control: signal(new AgridControl()),
      dataSource: signal(dataSource),
      colDefs: signal([{ field: 'hiredAt', header: 'Hired', type: 'date' }]),
      visibleColDefs: signal([{ field: 'hiredAt', header: 'Hired', type: 'date' }]),
      selectedRowIndex: signal(0),
      autoOpenDetail: signal(false),
      useSidebarEditor: signal(false),
      onCellEdit: () => undefined,
    });

    controller.commitEdit(
      'hiredAt',
      { field: 'hiredAt', header: 'Hired', type: 'date' },
      '2025-04-20',
    );

    expect(dataSource.getRow(0)['hiredAt']).toBe('2025-04-20T14:30:00.000Z');
  });
});
