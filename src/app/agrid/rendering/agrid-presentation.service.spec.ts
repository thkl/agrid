import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { AgridControl } from '../agrid-control';
import { AgridBrowserAdapter } from '../infrastructure/agrid-browser.adapter';
import { AgridPresentationService } from './agrid-presentation.service';

describe('AgridPresentationService', () => {
  it('formats cells, aggregates, and footer values', () => {
    const control = new AgridControl();
    control.setAggregate('amount', 'sum');
    const service = new AgridPresentationService({
      control: signal(control),
      visibleColDefs: signal([{ field: 'amount', header: 'Amount' }]),
      exportRows: signal([]),
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
      exportRows: signal([]),
      locale: signal('de-DE'),
    });

    expect(service.getFooterDisplay({ field: 'amount', header: 'Amount' }, 1000)).toBe('1.000');
  });

  it('resolves cell and row CSS classes from callbacks, defaulting to empty', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      exportRows: signal([]),
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
      exportRows: signal([]),
      locale: signal('en-US'),
    });
    expect(service.getRowClass({ a: 1 }, 0)).toBe('');
  });

  it('maps every built-in aggregate to its glyph and ignores custom/missing aggregates', () => {
    const make = (agg: unknown) =>
      new AgridPresentationService({
        control: signal(null),
        visibleColDefs: signal([]),
        exportRows: signal([]),
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
      exportRows: signal([]),
      locale: signal('en-US'),
    });
    expect(service.getAggregateLabel({ field: 'x', header: 'X', aggregate: 'sum' })).toBe('Ø');
    expect(service.hasAggregate({ field: 'unknown', header: 'U' })).toBe(false);
  });

  it('formats footer values: blanks, formatter, numbers, and strings', () => {
    const service = new AgridPresentationService({
      control: signal(null),
      visibleColDefs: signal([]),
      exportRows: signal([]),
      locale: signal('en-US'),
    });
    const col = { field: 'x', header: 'X' };
    expect(service.getFooterDisplay(col, null)).toBe('');
    expect(service.getFooterDisplay(col, '')).toBe('');
    expect(service.getFooterDisplay({ ...col, formatter: v => `$${v}` }, 5)).toBe('$5');
    expect(service.getFooterDisplay(col, 1234)).toBe('1,234');
    expect(service.getFooterDisplay(col, 'text')).toBe('text');
  });

  it('exports the supplied rows to CSV, escaping values and headers', () => {
    const captured: { filename: string; text: string; mime: string }[] = [];
    const browser = {
      downloadText: (filename: string, text: string, mime: string) => {
        captured.push({ filename, text, mime });
        return true;
      },
    } as unknown as AgridBrowserAdapter;

    // Row selection (filter/sort/grouping) is the component's job; the service formats what it gets.
    const service = new AgridPresentationService(
      {
        control: signal(null),
        visibleColDefs: signal([
          { field: 'name', header: 'Name' },
          { field: 'note', header: 'No,te' },
        ]),
        exportRows: signal([
          { name: 'Alice', note: 'a,b' },
          { name: 'Bob "B"', note: 'x' },
        ]),
        locale: signal('en-US'),
      },
      browser,
    );

    service.exportCsv('export.csv');

    expect(captured).toHaveLength(1);
    expect(captured[0].filename).toBe('export.csv');
    expect(captured[0].mime).toBe('text/csv;charset=utf-8;');

    const lines = captured[0].text.split('\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[0]).toBe('Name,"No,te"'); // header comma escaped
    expect(lines[1]).toBe('Alice,"a,b"'); // value comma escaped
    expect(lines[2]).toBe('"Bob ""B""",x'); // embedded quotes doubled and wrapped
  });

  it('exports typed cells to xlsx and downloads bytes with the xlsx mime type', () => {
    const captured: { filename: string; bytes: Uint8Array; mime: string }[] = [];
    const browser = {
      downloadBytes: (filename: string, bytes: Uint8Array, mime: string) => {
        captured.push({ filename, bytes, mime });
        return true;
      },
    } as unknown as AgridBrowserAdapter;

    const service = new AgridPresentationService(
      {
        control: signal(null),
        visibleColDefs: signal([
          { field: 'amount', header: 'Amount', type: 'number' },
          { field: 'dept', header: 'Dept', values: [{ value: 2, label: 'Sales' }] },
        ]),
        exportRows: signal([{ amount: 1200, dept: 2 }]),
        locale: signal('en-US'),
      },
      browser,
    );

    service.exportXlsx('grid.xlsx');

    expect(captured).toHaveLength(1);
    expect(captured[0].filename).toBe('grid.xlsx');
    expect(captured[0].mime).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    const sheet = unzip(captured[0].bytes)['xl/worksheets/sheet1.xml'];
    // numeric column → native number cell
    expect(sheet).toContain('<c r="A2"><v>1200</v></c>');
    // value-list column → resolved label as inline string (only one data row exported)
    expect(sheet).toContain('<is><t>Sales</t></is>');
    expect(sheet.match(/<row /g)).toHaveLength(2); // header + 1 data row
  });

  it('exports a collapsible outline with subtotal rows when grouped', () => {
    const captured: Uint8Array[] = [];
    const browser = {
      downloadBytes: (_filename: string, bytes: Uint8Array) => {
        captured.push(bytes);
        return true;
      },
    } as unknown as AgridBrowserAdapter;

    const service = new AgridPresentationService(
      {
        control: signal(null),
        visibleColDefs: signal([
          { field: 'dept', header: 'Dept' },
          { field: 'amount', header: 'Amount', type: 'number', aggregate: 'sum' },
        ]),
        exportRows: signal([]), // ignored when exportGroups is present
        exportGroups: signal([
          {
            label: 'Eng',
            rows: [{ dept: 'Eng', amount: 100 }, { dept: 'Eng', amount: 200 }],
            aggregates: { amount: 300 },
          },
        ]),
        locale: signal('en-US'),
      },
      browser,
    );

    service.exportXlsx('grouped.xlsx');

    const sheet = unzip(captured[0])['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('<outlinePr summaryBelow="0"/>');         // collapsible outline
    expect(sheet).toContain('<is><t>Eng (2)</t></is>');               // group summary label + count
    expect(sheet).toContain('<c r="B2" s="1"><v>300</v></c>');        // bold subtotal on summary row
    expect(sheet).toContain('outlineLevel="1"');                       // detail rows indented
    expect(sheet.match(/<row /g)).toHaveLength(4); // header + summary + 2 detail rows
  });
});

/** Minimal reader for the STORED-only archives produced by buildXlsx. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06_05_4b_50) eocd--;
  const count = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const size = view.getUint32(cd + 24, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOffset = view.getUint32(cd + 42, true);
    const name = decoder.decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    out[name] = decoder.decode(bytes.subarray(dataStart, dataStart + size));
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
