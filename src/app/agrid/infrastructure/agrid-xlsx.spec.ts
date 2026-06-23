import { describe, expect, it } from 'vitest';
import { XlsxSheet, buildXlsx, columnLetter, excelSerial } from './agrid-xlsx';

/** Minimal reader for the STORED-only archives produced by {@link buildXlsx}. */
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

describe('agrid-xlsx', () => {
  it('maps column indices to spreadsheet letters', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });

  it('computes Excel serial dates (1900 system)', () => {
    expect(excelSerial(new Date(2020, 0, 1))).toBe(43831);
    expect(excelSerial(new Date(1900, 0, 1))).toBe(2); // 1900-01-01 (after the leap-year quirk)
  });

  it('produces a structurally complete workbook with all required parts', () => {
    const parts = unzip(buildXlsx([{ name: 'Data', header: ['A'], rows: [] }]));
    expect(Object.keys(parts).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(parts['xl/workbook.xml']).toContain('name="Data"');
  });

  it('encodes typed cells: string, number, date, boolean, empty', () => {
    const sheet: XlsxSheet = {
      name: 'Sheet1',
      header: ['Name', 'Amount', 'Hired', 'Active', 'Notes'],
      rows: [{
        cells: [
          { kind: 'string', value: 'Tom & Jerry' },
          { kind: 'number', value: 1234.5 },
          { kind: 'date', value: new Date(2020, 0, 1) },
          { kind: 'boolean', value: true },
          { kind: 'empty' },
        ],
      }],
    };
    const xml = unzip(buildXlsx([sheet]))['xl/worksheets/sheet1.xml'];

    // Bold header style (s="1") + inline strings.
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t>Name</t></is></c>');
    // XML escaping in inline strings.
    expect(xml).toContain('<is><t>Tom &amp; Jerry</t></is>');
    // Numeric cell (no type attribute, raw value).
    expect(xml).toContain('<c r="B2"><v>1234.5</v></c>');
    // Date cell carries the date style and serial value.
    expect(xml).toContain('<c r="C2" s="2"><v>43831</v></c>');
    // Boolean cell.
    expect(xml).toContain('<c r="D2" t="b"><v>1</v></c>');
    // Empty cell.
    expect(xml).toContain('<c r="E2"/>');
    // Header row frozen.
    expect(xml).toContain('state="frozen"');
  });

  it('emits a collapsible outline with emphasized summary rows when outline is set', () => {
    const sheet: XlsxSheet = {
      name: 'Grouped',
      header: ['Dept', 'Amount'],
      outline: true,
      rows: [
        { cells: [{ kind: 'string', value: 'Eng (2)' }, { kind: 'number', value: 300 }], level: 0, emphasized: true },
        { cells: [{ kind: 'string', value: 'Eng' }, { kind: 'number', value: 100 }], level: 1 },
        { cells: [{ kind: 'string', value: 'Eng' }, { kind: 'number', value: 200 }], level: 1 },
      ],
    };
    const xml = unzip(buildXlsx([sheet]))['xl/worksheets/sheet1.xml'];

    expect(xml).toContain('<outlinePr summaryBelow="0"/>'); // outline declared, summary above details
    expect(xml).toContain('<row r="2">');                   // summary row at top level (no outlineLevel)
    expect(xml).toContain('outlineLevel="1"');              // detail rows indented one level
    // Summary row cells carry the bold style.
    expect(xml).toContain('<c r="A2" s="1" t="inlineStr"><is><t>Eng (2)</t></is></c>');
    expect(xml).toContain('<c r="B2" s="1"><v>300</v></c>');
  });

  it('preserves leading/trailing whitespace in strings', () => {
    const xml = unzip(buildXlsx([{
      name: 'S', header: ['H'], rows: [{ cells: [{ kind: 'string', value: '  pad  ' }] }],
    }]))['xl/worksheets/sheet1.xml'];
    expect(xml).toContain('xml:space="preserve"');
  });

  it('writes one worksheet part and override per sheet', () => {
    const make = (name: string): XlsxSheet => ({ name, header: ['A'], rows: [] });
    const parts = unzip(buildXlsx([make('One'), make('Two')]));
    expect(parts['xl/worksheets/sheet2.xml']).toBeDefined();
    expect(parts['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
    expect(parts['xl/workbook.xml']).toContain('r:id="rId2"');
  });

  it('sanitizes invalid sheet-name characters and length', () => {
    const longName = 'a/b:c'.padEnd(40, 'x');
    const wb = unzip(buildXlsx([{ name: longName, header: ['A'], rows: [] }]))['xl/workbook.xml'];
    const name = /name="([^"]*)"/.exec(wb)?.[1] ?? '';
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[\\/?*[\]:]/);
  });
});
