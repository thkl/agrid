import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from '../agrid-control';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { GridItem } from '../agrid.types';
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

  it('formats numeric footer values with the configured locale', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      filteredItems: signal([]),
      locale: signal('de-DE'),
    });

    expect(service.getFooterDisplay({ field: 'amount', header: 'Amount' }, 1000)).toBe('1.000');
  });

  it('resolves cell and row CSS classes from callbacks, defaulting to empty', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      filteredItems: signal([]),
      locale: signal('en-US'),
      getRowClass: signal(({ index }) => (index % 2 === 0 ? 'even' : 'odd')),
    });

    const col = { field: 'a', header: 'A', cellClass: ({ value }: { value: unknown }) => (value === 1 ? 'hi' : '') };
    expect(service.getCellClass(col, 1, { a: 1 })).toBe('hi');
    expect(service.getCellClass(col, 2, { a: 2 })).toBe('');
    // Column without a cellClass callback yields no class.
    expect(service.getCellClass({ field: 'a', header: 'A' }, 1, { a: 1 })).toBe('');

    expect(service.getRowClass({ a: 1 }, 0)).toBe('even');
    expect(service.getRowClass({ a: 1 }, 1)).toBe('odd');
  });

  it('returns no row class when no getRowClass option is provided', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      filteredItems: signal([]),
      locale: signal('en-US'),
    });
    expect(service.getRowClass({ a: 1 }, 0)).toBe('');
  });

  it('maps every built-in aggregate to its glyph and ignores custom/missing aggregates', () => {
    const make = (agg: unknown) =>
      new AgridPresentationService({
        control: signal(null),
        visibleColDefs: signal([]),
        filteredItems: signal([]),
        locale: signal('en-US'),
      }).getAggregateLabel({ field: 'x', header: 'X', aggregate: agg as never });

    expect(make('sum')).toBe('Σ');
    expect(make('avg')).toBe('Ø');
    expect(make('min')).toBe('↓');
    expect(make('max')).toBe('↑');
    expect(make('count')).toBe('#');
    expect(make(() => 0)).toBe(''); // custom function aggregate has no glyph
    expect(make(undefined)).toBe(''); // no aggregate
  });

  it('prefers a runtime control aggregate over the column definition', () => {
    const control = new AgridControl();
    control.setAggregate('x', 'avg');
    const service = new AgridPresentationService({
      control: signal(control),
      visibleColDefs: signal([]),
      filteredItems: signal([]),
      locale: signal('en-US'),
    });
    expect(service.getAggregateLabel({ field: 'x', header: 'X', aggregate: 'sum' })).toBe('Ø');
    expect(service.hasAggregate({ field: 'unknown', header: 'U' })).toBe(false);
  });

  it('formats footer values: blanks, formatter, numbers, and strings', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      filteredItems: signal([]),
      locale: signal('en-US'),
    });
    const col = { field: 'x', header: 'X' };
    expect(service.getFooterDisplay(col, null)).toBe('');
    expect(service.getFooterDisplay(col, '')).toBe('');
    expect(service.getFooterDisplay({ ...col, formatter: v => `$${v}` }, 5)).toBe('$5');
    expect(service.getFooterDisplay(col, 1234)).toBe('1,234');
    expect(service.getFooterDisplay(col, 'text')).toBe('text');
  });

  it('exports projected data rows to CSV, escaping and filtering non-data rows', () => {
    const captured: { filename: string; text: string; mime: string }[] = [];
    const browser = {
      downloadText: (filename: string, text: string, mime: string) => {
        captured.push({ filename, text, mime });
        return true;
      },
    } as unknown as AgridBrowserAdapter;

    const items: GridItem[] = [
      { originalIndex: 0, row: { name: 'Alice', note: 'a,b' } } as unknown as GridItem,
      { detailFor: 0, row: { name: 'detail' } } as unknown as GridItem, // not a data row → excluded
      { originalIndex: 1, row: { name: 'Bob "B"', note: 'x' } } as unknown as GridItem,
    ];

    const service = new AgridPresentationService(
      {
        control: signal(null),
        visibleColDefs: signal([
          { field: 'name', header: 'Name' },
          { field: 'note', header: 'No,te' },
        ]),
        filteredItems: signal(items),
        locale: signal('en-US'),
      },
      browser,
    );

    service.exportCsv('export.csv');

    expect(captured).toHaveLength(1);
    expect(captured[0].filename).toBe('export.csv');
    expect(captured[0].mime).toBe('text/csv;charset=utf-8;');

    const lines = captured[0].text.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows (detail row excluded)
    expect(lines[0]).toBe('Name,"No,te"'); // header comma escaped
    expect(lines[1]).toBe('Alice,"a,b"'); // value comma escaped
    expect(lines[2]).toBe('"Bob ""B""",x'); // embedded quotes doubled and wrapped
  });
});
