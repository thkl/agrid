/**
 * Minimal zero-dependency BIFF8 `.xls` writer.
 *
 * This intentionally targets plain import workbooks: multiple worksheets with strings, numbers,
 * booleans, dates, and empty cells. It does not try to clone Excel's formatting surface.
 * @internal
 */

import { XlsxCell, XlsxSheet, excelSerial } from './agrid-xlsx';

export type XlsCell = XlsxCell;
export type XlsSheet = XlsxSheet;

export const XLS_CONTENT_TYPE = 'application/vnd.ms-excel';

const SECTOR_SIZE = 512;
const FREE_SECT = 0xff_ff_ff_ff;
const END_OF_CHAIN = 0xff_ff_ff_fe;
const FAT_SECT = 0xff_ff_ff_fd;
const NO_STREAM = 0xff_ff_ff_ff;

interface BiffSheet {
  name: string;
  records: Uint8Array<ArrayBufferLike>;
}

interface SharedString {
  value: string;
  index: number;
}

export function buildXls(sheets: XlsSheet[]): Uint8Array<ArrayBufferLike> {
  const sharedStrings = collectSharedStrings(sheets);
  const biffSheets = sheets.map(sheet => ({
    name: sheetName(sheet.name),
    records: worksheetRecords(sheet, sharedStrings),
  }));
  return oleWorkbook(workbookRecords(biffSheets, sharedStrings));
}

function workbookRecords(
  sheets: BiffSheet[],
  sharedStrings: Map<string, SharedString>,
): Uint8Array<ArrayBufferLike> {
  const beforeBounds = concatRecords([
    record(0x0809, u16(0x0600, 0x0005, 0x0dbb, 0x07cc, 0x0041, 0x0000, 0x0000, 0x0000)),
    record(0x0042, u16(1200)),
    record(0x0161, u16(0)),
    record(0x01ae, u16(1)),
    record(0x003d, u16(0x0012)),
    record(0x0019, u16(0)),
    record(0x0012, u16(0)),
    record(0x0013, u16(0)),
    record(0x01af, u16(0)),
    record(0x0040, u16(0)),
    record(0x008d, u16(0)),
    record(0x0022, u16(0)),
    record(0x000e, u16(1)),
    record(0x01b7, u16(0)),
    record(0x00da, u16(0)),
    fontRecord(),
    fontRecord(),
    fontRecord(),
    fontRecord(),
    xfRecord(),
    xfRecord(),
    xfRecord(),
    xfRecord(),
    xfRecord(),
    xfRecord(),
  ]);
  const boundSheetSize = sheets.reduce((sum, sheet) => sum + 4 + 8 + stringByteLength(sheet.name), 0);
  const sst = sstRecord(sharedStrings);
  const globalsSize = beforeBounds.length + boundSheetSize + sst.length + 4;
  let sheetOffset = globalsSize;
  const bounds = sheets.map(sheet => {
    const out = boundSheetRecord(sheet.name, sheetOffset);
    sheetOffset += sheet.records.length;
    return out;
  });
  return concatBytes(beforeBounds, ...bounds, sst, record(0x000a), ...sheets.map(sheet => sheet.records));
}

function worksheetRecords(
  sheet: XlsSheet,
  sharedStrings: Map<string, SharedString>,
): Uint8Array<ArrayBufferLike> {
  const rows = [{ cells: sheet.header.map(value => ({ kind: 'string', value }) as XlsCell) }, ...sheet.rows];
  const width = Math.max(sheet.header.length, ...sheet.rows.map(row => row.cells.length), 0);
  const records: Uint8Array<ArrayBufferLike>[] = [
    record(0x0809, u16(0x0600, 0x0010, 0x0dbb, 0x07cc, 0x0041, 0x0000, 0x0000, 0x0000)),
    record(0x0200, bytes(u32(rows.length), u32(0), u16(0), u16(width), u16(0))),
    record(0x0225, u16(0x00ff)),
  ];
  rows.forEach((row, rowIndex) => {
    records.push(rowRecord(rowIndex, width));
    row.cells.forEach((cell, colIndex) => {
      const cellRecord = encodeCell(rowIndex, colIndex, cell, sharedStrings);
      if (cellRecord) records.push(cellRecord);
    });
  });
  records.push(record(0x000a));
  return concatBytes(...records);
}

function encodeCell(
  row: number,
  col: number,
  cell: XlsCell,
  sharedStrings: Map<string, SharedString>,
): Uint8Array<ArrayBufferLike> | null {
  switch (cell.kind) {
    case 'empty':
      return null;
    case 'string':
      return record(0x00fd, bytes(u16(row), u16(col), u16(0), u32(sharedStrings.get(cell.value)?.index ?? 0)));
    case 'number':
      return Number.isFinite(cell.value)
        ? record(0x0203, bytes(u16(row), u16(col), u16(0), f64(cell.value)))
        : null;
    case 'date':
      return record(0x0203, bytes(u16(row), u16(col), u16(0), f64(excelSerial(cell.value))));
    case 'boolean':
      return record(0x0205, bytes(u16(row), u16(col), u16(0), u8(cell.value ? 1 : 0), u8(0)));
  }
}

function collectSharedStrings(sheets: XlsSheet[]): Map<string, SharedString> {
  const strings = new Map<string, SharedString>();
  const add = (value: string) => {
    if (!strings.has(value)) strings.set(value, { value, index: strings.size });
  };
  sheets.forEach(sheet => {
    sheet.header.forEach(add);
    sheet.rows.forEach(row => row.cells.forEach(cell => {
      if (cell.kind === 'string') add(cell.value);
    }));
  });
  return strings;
}

function sstRecord(strings: Map<string, SharedString>): Uint8Array<ArrayBufferLike> {
  const entries = [...strings.values()]
    .sort((a, b) => a.index - b.index)
    .map(entry => xlString(entry.value));
  return record(0x00fc, bytes(u32(strings.size), u32(strings.size), ...entries));
}

function boundSheetRecord(name: string, offset: number): Uint8Array<ArrayBufferLike> {
  return record(0x0085, bytes(u32(offset), u8(0), u8(0), xlShortString(name)));
}

function rowRecord(index: number, width: number): Uint8Array<ArrayBufferLike> {
  return record(0x0208, bytes(
    u16(index), u16(0), u16(width), u16(0x00ff),
    u16(0), u16(0), u16(0x0100), u16(0),
  ));
}

function fontRecord(): Uint8Array<ArrayBufferLike> {
  return record(0x0031, bytes(
    u16(200), u16(0), u16(0x7fff), u16(400), u16(0), u16(0), u8(0), u8(0),
    xlShortString('Arial'),
  ));
}

function xfRecord(): Uint8Array<ArrayBufferLike> {
  return record(0x00e0, bytes(
    u16(0), u16(0), u16(0xfff5), u16(0x20), u16(0), u16(0), u32(0), u32(0), u16(0),
  ));
}

function record(
  id: number,
  data: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array<ArrayBufferLike> {
  return bytes(u16(id), u16(data.length), data);
}

function sheetName(name: string): string {
  const cleaned = (name || 'Sheet1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
  return cleaned || 'Sheet1';
}

function xlShortString(value: string): Uint8Array<ArrayBufferLike> {
  const compressed = isCompressed(value);
  const text = compressed ? latin1(value) : utf16(value);
  return bytes(u8(value.length), u8(compressed ? 0 : 1), text);
}

function xlString(value: string): Uint8Array<ArrayBufferLike> {
  const compressed = isCompressed(value);
  const text = compressed ? latin1(value) : utf16(value);
  return bytes(u16(value.length), u8(compressed ? 0 : 1), text);
}

function stringByteLength(value: string): number {
  return 8 + 1 + 1 + value.length * (isCompressed(value) ? 1 : 2);
}

function isCompressed(value: string): boolean {
  return [...value].every(ch => ch.charCodeAt(0) <= 0xff);
}

function latin1(value: string): Uint8Array<ArrayBufferLike> {
  return Uint8Array.from([...value].map(ch => ch.charCodeAt(0) & 0xff));
}

function utf16(value: string): Uint8Array<ArrayBufferLike> {
  const out = new Uint8Array(value.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < value.length; i++) view.setUint16(i * 2, value.charCodeAt(i), true);
  return out;
}

function oleWorkbook(workbook: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBufferLike> {
  const workbookSectors = Math.ceil(workbook.length / SECTOR_SIZE);
  const dirSectors = 1;
  const fatSectors = Math.ceil((workbookSectors + dirSectors + 1) / 128);
  if (fatSectors > 109) {
    throw new Error('XLS export is too large for the minimal writer.');
  }
  const totalSectors = workbookSectors + dirSectors + fatSectors;
  const file = new Uint8Array(SECTOR_SIZE + totalSectors * SECTOR_SIZE);
  const view = new DataView(file.buffer);
  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  writeU16(view, 0x18, 0x003e);
  writeU16(view, 0x1a, 0x0003);
  writeU16(view, 0x1c, 0xfffe);
  writeU16(view, 0x1e, 0x0009);
  writeU16(view, 0x20, 0x0006);
  writeU32(view, 0x2c, fatSectors);
  writeU32(view, 0x30, workbookSectors);
  writeU32(view, 0x38, 4096);
  writeU32(view, 0x3c, END_OF_CHAIN);
  writeU32(view, 0x40, 0);
  writeU32(view, 0x44, END_OF_CHAIN);
  writeU32(view, 0x48, 0);
  for (let i = 0; i < 109; i++) writeU32(view, 0x4c + i * 4, i < fatSectors ? workbookSectors + dirSectors + i : FREE_SECT);

  file.set(workbook, SECTOR_SIZE);
  const dirSector = workbookSectors;
  writeDirectory(file, dirSector, workbook.length);

  const fat = new Uint32Array(fatSectors * 128);
  fat.fill(FREE_SECT);
  for (let i = 0; i < workbookSectors; i++) fat[i] = i === workbookSectors - 1 ? END_OF_CHAIN : i + 1;
  fat[dirSector] = END_OF_CHAIN;
  for (let i = 0; i < fatSectors; i++) fat[workbookSectors + dirSectors + i] = FAT_SECT;
  for (let i = 0; i < fat.length; i++) writeU32(view, SECTOR_SIZE + (workbookSectors + dirSectors) * SECTOR_SIZE + i * 4, fat[i]);

  return file;
}

function writeDirectory(file: Uint8Array, sector: number, workbookSize: number): void {
  const offset = SECTOR_SIZE + sector * SECTOR_SIZE;
  writeDirEntry(file, offset, 'Root Entry', 5, 1, NO_STREAM, NO_STREAM, END_OF_CHAIN, 0);
  writeDirEntry(file, offset + 128, 'Workbook', 2, NO_STREAM, NO_STREAM, NO_STREAM, 0, workbookSize);
}

function writeDirEntry(
  file: Uint8Array,
  offset: number,
  name: string,
  type: number,
  child: number,
  left: number,
  right: number,
  start: number,
  size: number,
): void {
  const view = new DataView(file.buffer);
  const encodedName = utf16(`${name}\0`);
  file.set(encodedName.subarray(0, 64), offset);
  writeU16(view, offset + 64, Math.min(encodedName.length, 64));
  file[offset + 66] = type;
  file[offset + 67] = 1;
  writeU32(view, offset + 68, left);
  writeU32(view, offset + 72, right);
  writeU32(view, offset + 76, child);
  writeU32(view, offset + 116, start);
  writeU32(view, offset + 120, size);
  writeU32(view, offset + 124, 0);
}

function concatRecords(records: Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBufferLike> {
  return concatBytes(...records);
}

function bytes(...parts: Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBufferLike> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function concatBytes(...parts: Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBufferLike> {
  return bytes(...parts);
}

function u8(value: number): Uint8Array<ArrayBufferLike> {
  return Uint8Array.of(value & 0xff);
}

function u16(...values: number[]): Uint8Array<ArrayBufferLike> {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return out;
}

function u32(value: number): Uint8Array<ArrayBufferLike> {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function f64(value: number): Uint8Array<ArrayBufferLike> {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value, true);
  return out;
}

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}
