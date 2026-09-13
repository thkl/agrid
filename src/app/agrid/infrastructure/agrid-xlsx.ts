/**
 * Zero-dependency `.xlsx` writer.
 *
 * An `.xlsx` file is a ZIP archive of small OOXML parts. This module emits both with no runtime
 * dependency: ZIP entries are written **STORED** (uncompressed), which every spreadsheet app
 * accepts, so no DEFLATE implementation is needed — only a CRC32 table and the OOXML XML.
 *
 * Trade-off: files are uncompressed, so very large exports produce large downloads. That is fine
 * for typical grid exports; a DEFLATE pass could be added later without changing this API.
 * @internal
 */

/** A single typed cell in an exported sheet. @internal */
export type XlsxCell =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'date'; value: Date }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'formula'; formula: string; value?: string | number }
  | { kind: 'empty' };

/** Basic OOXML-compatible font and cell styling options. @internal */
export interface XlsxCellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  fontColor?: string;
  fillColor?: string;
  horizontalAlignment?: 'left' | 'center' | 'right';
}

/** One data/summary row, with optional outline depth and bold emphasis. @internal */
export interface XlsxRow {
  cells: XlsxCell[];
  /** Outline/group depth used for Excel's collapsible row grouping (0 = top level). */
  level?: number;
  /** Render the row with the bold style (used for group subtotal rows). */
  emphasized?: boolean;
}

/** One worksheet: a bold header row followed by typed data rows. @internal */
export interface XlsxSheet {
  /** Tab name. Sanitized to Excel's constraints (≤31 chars, no `\ / ? * [ ] :`). */
  name: string;
  header: string[];
  rows: XlsxRow[];
  /** Declare a collapsible row outline (summary rows sit above their detail rows). */
  outline?: boolean;
  /** Style applied to the header row. */
  headerStyle?: XlsxCellStyle;
  /** Style applied to ordinary data cells. */
  bodyStyle?: XlsxCellStyle;
  /** Optional pixel widths for columns. */
  columnWidths?: number[];
}

// Style indices baked into styles.xml below: 0 = default, 1 = bold header, 2 = date.
const STYLE_HEADER = 1;
const STYLE_DATE = 2;
const DATE_NUM_FMT_ID = 164;

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** MIME type to use when downloading the bytes returned by {@link buildXlsx}. @internal */
export const XLSX_CONTENT_TYPE = XLSX_MIME;

const encoder = new TextEncoder();

/** Builds a complete `.xlsx` workbook as bytes from one or more sheets. */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const styles = buildStyles(sheets);
  const files: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml(sheets.length)) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheets)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml(sheets.length)) },
    { name: 'xl/styles.xml', data: encoder.encode(styles.xml) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: encoder.encode(sheetXml(sheet, styles)),
    })),
  ];
  return zipStored(files);
}

/** Converts a JS `Date` to an Excel serial number (1900 date system, via the 1899-12-30 epoch). */
export function excelSerial(date: Date): number {
  // Use the date's wall-clock components so values do not drift across time zones.
  const utc = Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(),
  );
  const epoch = Date.UTC(1899, 11, 30);
  return (utc - epoch) / 86_400_000;
}

// ── OOXML parts ───────────────────────────────────────────────────────────────

const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="${DATE_NUM_FMT_ID}" formatCode="yyyy-mm-dd"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="${DATE_NUM_FMT_ID}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

interface StyleTable {
  xml: string;
  index(style: XlsxCellStyle | undefined, emphasized: boolean, date: boolean): number;
}

function buildStyles(sheets: XlsxSheet[]): StyleTable {
  const keys = new Map<string, number>();
  const styles: Array<{ style: XlsxCellStyle; emphasized: boolean; date: boolean }> = [];
  const index = (style: XlsxCellStyle | undefined, emphasized: boolean, date: boolean): number => {
    const normalized = { ...(style ?? {}) };
    if (emphasized) normalized.bold = true;
    const key = JSON.stringify([normalized, date]);
    const existing = keys.get(key);
    if (existing !== undefined) return existing;
    const value = styles.length;
    keys.set(key, value);
    styles.push({ style: normalized, emphasized: false, date });
    return value;
  };

  // Keep style 0 as the historical default and style 1 as the historical bold header.
  index(undefined, false, false);
  index(undefined, true, false);
  for (const sheet of sheets) {
    index(sheet.headerStyle, true, false);
    index(sheet.bodyStyle, false, false);
    for (const row of sheet.rows) for (const cell of row.cells) {
      index(undefined, !!row.emphasized, cell.kind === 'date');
    }
  }
  const fonts = styles.map(({ style }) =>
    `<font><sz val="${style.fontSize ?? 11}"/><name val="${escapeAttr(style.fontFamily ?? 'Calibri')}"/>` +
    `${style.bold ? '<b/>' : ''}${style.italic ? '<i/>' : ''}` +
    `${style.fontColor ? `<color rgb="${color(style.fontColor)}"/>` : ''}</font>`).join('');
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  for (const { style } of styles.slice(2)) {
    fills.push(style.fillColor
      ? `<fill><patternFill patternType="solid"><fgColor rgb="${color(style.fillColor)}"/><bgColor indexed="64"/></patternFill></fill>`
      : '<fill><patternFill patternType="none"/></fill>');
  }
  const xfs = styles.map(({ style, date }, i) => {
    const fillId = i < 2 ? 0 : i;
    const alignment = style.horizontalAlignment ? ` applyAlignment="1"><alignment horizontal="${style.horizontalAlignment}"/></xf>` : '/>';
    return `<xf numFmtId="${date ? DATE_NUM_FMT_ID : 0}" fontId="${i}" fillId="${fillId}" borderId="0" xfId="0"${alignment}`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="${DATE_NUM_FMT_ID}" formatCode="yyyy-mm-dd"/></numFmts>` +
    `<fonts count="${fonts.length}">${fonts}</fonts><fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return { xml, index };
}

function color(value: string): string {
  const hex = value.replace(/^#/, '').trim();
  return /^[0-9a-f]{6}$/i.test(hex) ? `FF${hex.toUpperCase()}` : value;
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    overrides +
    `</Types>`;
}

function workbookXml(sheets: XlsxSheet[]): string {
  const entries = sheets.map((sheet, i) =>
    `<sheet name="${escapeAttr(sheetName(sheet.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${entries}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  const stylesRel =
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetRels + stylesRel + `</Relationships>`;
}

function sheetXml(sheet: XlsxSheet, styles: StyleTable): string {
  const headerCells = sheet.header
    .map((label, c) => `<c r="${cellRef(c, 1)}" s="${styles.index(sheet.headerStyle, true, false)}" t="inlineStr"><is><t${preserve(label)}>${escapeText(label)}</t></is></c>`)
    .join('');
  const rows = [`<row r="1">${headerCells}</row>`];
  sheet.rows.forEach((row, ri) => {
    const r = ri + 2;
    const cells = row.cells.map((cell, c) => cellXml(cellRef(c, r), cell, styles.index(sheet.bodyStyle, !!row.emphasized, cell.kind === 'date'))).join('');
    const level = row.level ? ` outlineLevel="${row.level}"` : '';
    rows.push(`<row r="${r}"${level}>${cells}</row>`);
  });
  // `summaryBelow="0"` puts each group's summary row above its (indented) detail rows.
  const sheetPr = sheet.outline ? `<sheetPr><outlinePr summaryBelow="0"/></sheetPr>` : '';
  const cols = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(1, width / 7)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const freeze =
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    sheetPr + freeze + cols + `<sheetData>${rows.join('')}</sheetData></worksheet>`;
}

function cellXml(ref: string, cell: XlsxCell, styleIndex: number): string {
  const style = styleIndex === 0 ? '' : ` s="${styleIndex}"`;
  switch (cell.kind) {
    case 'number':
      return Number.isFinite(cell.value) ? `<c r="${ref}"${style}><v>${cell.value}</v></c>` : `<c r="${ref}"${style}/>`;
    case 'boolean':
      return `<c r="${ref}" t="b"><v>${cell.value ? 1 : 0}</v></c>`;
    case 'formula': {
      const result = cell.value === undefined ? '' : `<v>${typeof cell.value === 'number' ? cell.value : escapeText(String(cell.value))}</v>`;
      const type = typeof cell.value === 'string' ? ' t="str"' : '';
      return `<c r="${ref}"${style}${type}><f>${escapeText(cell.formula)}</f>${result}</c>`;
    }
    case 'date':
      return `<c r="${ref}"${style}><v>${excelSerial(cell.value)}</v></c>`;
    case 'string':
      return `<c r="${ref}"${style} t="inlineStr"><is><t${preserve(cell.value)}>${escapeText(cell.value)}</t></is></c>`;
    case 'empty':
      return `<c r="${ref}"${style}/>`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a zero-based column index to a spreadsheet column letter (0→A, 26→AA). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function cellRef(col: number, row: number): string {
  return `${columnLetter(col)}${row}`;
}

function sheetName(name: string, index: number): string {
  const cleaned = (name || `Sheet${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, ch => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function preserve(value: string): string {
  return /^\s|\s$/.test(value) ? ' xml:space="preserve"' : '';
}

// ── STORED ZIP container ──────────────────────────────────────────────────────

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function zipStored(files: ZipEntry[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const u16 = (arr: number[], v: number) => arr.push(v & 0xff, (v >>> 8) & 0xff);
  const u32 = (arr: number[], v: number) =>
    arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  const bytes = (arr: number[], src: Uint8Array) => {
    for (let i = 0; i < src.length; i++) arr.push(src[i]);
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const offset = local.length;

    // Local file header (DOS date 1980-01-01, no time).
    u32(local, 0x04_03_4b_50);
    u16(local, 20); u16(local, 0); u16(local, 0); u16(local, 0); u16(local, 0x21);
    u32(local, crc); u32(local, size); u32(local, size);
    u16(local, nameBytes.length); u16(local, 0);
    bytes(local, nameBytes);
    bytes(local, file.data);

    // Central directory record.
    u32(central, 0x02_01_4b_50);
    u16(central, 20); u16(central, 20); u16(central, 0); u16(central, 0);
    u16(central, 0); u16(central, 0x21);
    u32(central, crc); u32(central, size); u32(central, size);
    u16(central, nameBytes.length); u16(central, 0); u16(central, 0);
    u16(central, 0); u16(central, 0); u32(central, 0);
    u32(central, offset);
    bytes(central, nameBytes);
  }

  const cdOffset = local.length;
  const eocd: number[] = [];
  u32(eocd, 0x06_05_4b_50);
  u16(eocd, 0); u16(eocd, 0);
  u16(eocd, files.length); u16(eocd, files.length);
  u32(eocd, central.length); u32(eocd, cdOffset); u16(eocd, 0);

  return Uint8Array.from([...local, ...central, ...eocd]);
}
