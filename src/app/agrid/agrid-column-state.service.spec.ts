import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from './agrid-control';
import { AgridColumnStateService } from './agrid-column-state.service';

describe('AgridColumnStateService', () => {
  it('reports display, pin, grouping, and ARIA state', () => {
    const control = new AgridControl({ groupByField: 'name' });
    control.setPinned('name', true);
    control.setPinnedRight('amount', true);
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'amount', header: 'Amount' },
    ];
    const service = new AgridColumnStateService({
      control: signal(control),
      colDefs: signal(columns),
      visibleColDefs: signal(columns),
      pinnedColDefs: signal([columns[0]]),
      rightPinnedColDefs: signal([columns[1]]),
      showControlColumn: signal(true),
    });

    expect(service.getAriaColIndex(0)).toBe(2);
    expect(service.isGroupedByField('name')).toBe(true);
    expect(service.getColumnPinState('name')).toBe('left');
    expect(service.getColumnPinState('amount')).toBe('right');
    expect(service.isFirstRightPinnedColumn('amount')).toBe(true);
    expect(service.isLastPinnedColumn('name')).toBe(true);
  });
});
