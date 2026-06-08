import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from './agrid-control';
import { AgridPresentationService } from './agrid-presentation.service';

describe('AgridPresentationService', () => {
  it('formats cells, aggregates, and footer values', () => {
    const control = new AgridControl();
    control.setAggregate('amount', 'sum');
    const service = new AgridPresentationService({
      control: signal(control),
      visibleColDefs: signal([{ field: 'amount', header: 'Amount' }]),
      filteredItems: signal([]),
      locale: signal('en-US'),
    });

    expect(service.getAggregateLabel({ field: 'amount', header: 'Amount' })).toBe('Σ');
    expect(service.hasAggregate({ field: 'amount', header: 'Amount' })).toBe(true);
    expect(service.getFooterDisplay({ field: 'amount', header: 'Amount' }, 1000)).toBe('1,000');
    expect(service.getCellTitle({ field: 'amount', header: 'Amount' }, 1)).toBe('1');
  });
});
