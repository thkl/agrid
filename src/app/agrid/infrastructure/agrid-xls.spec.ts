import { describe, expect, it } from 'vitest';
import { buildXls } from './agrid-xls';

interface ParsedSheet {
  name: string;
  cells: Record<string, string | number | boolean>;
}

function parseWorkbook(bytes: Uint8Array): ParsedSheet[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const firstDirectorySector = view.getUint32(0x30, true);
  const fatSectorCount = view.getUint32(0x2c, true);
  const fat: number[] = [];
  for (let i = 0; i < fatSectorCount; i++) {
    const sector = view.getUint32(0x4c + i * 4, true);
    const offset = sectorOffset(sectorSize, sector);
    for (let j = 0; j < sectorSize / 4; j++) fat.push(view.getUint32(offset + j * 4, true));
  }

  const readChain = (start: number, size?: number): Uint8Array => {
    const chunks: Uint8Array[] = [];
    let sector = start;
    while (sector < 0xff_ff_ff_f0) {
      chunks.push(bytes.subarray(sectorOffset(sectorSize, sector), sectorOffset(sectorSize, sector + 1)));
      sector = fat[sector];
    }
    const out = concat(chunks);
    return size === undefined ? out : out.subarray(0, size);
  };

  const directory = readChain(firstDirectorySector);
  let workbook = new Uint8Array();
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = new DataView(directory.buffer, directory.byteOffset + offset, 128).getUint16(64, true);
    if (!nameLength) continue;
    const name = utf16(directory.subarray(offset, offset + nameLength - 2));
    if (name === 'Workbook') {
      const entry = new DataView(directory.buffer, directory.byteOffset + offset, 128);
      workbook = readChain(entry.getUint32(116, true), entry.getUint32(120, true));
    }
  }

  const sheets: { name: string; offset: number }[] = [];
  const sharedStrings: string[] = [];
  forEachRecord(workbook, 0, workbook.length, (id, data) => {
    if (id === 0x0085) {
      sheets.push({ offset: getU32(data, 0), name: shortString(data, 6) });
    }
    if (id === 0x00fc) {
      let pos = 8;
      const unique = getU32(data, 4);
      for (let i = 0; i < unique; i++) {
        const decoded = longString(data, pos);
        sharedStrings.push(decoded.value);
        pos = decoded.next;
      }
    }
  });

  return sheets.map((sheet, index) => {
    const end = sheets[index + 1]?.offset ?? workbook.length;
    const cells: Record<string, string | number | boolean> = {};
    forEachRecord(workbook, sheet.offset, end, (id, data) => {
      if (id === 0x00fd) {
        cells[cellRef(getU16(data, 2), getU16(data, 0))] = sharedStrings[getU32(data, 6)];
      }
      if (id === 0x0203) {
        cells[cellRef(getU16(data, 2), getU16(data, 0))] =
          new DataView(data.buffer, data.byteOffset).getFloat64(6, true);
      }
      if (id === 0x0205) {
        cells[cellRef(getU16(data, 2), getU16(data, 0))] = data[6] === 1;
      }
    });
    return { name: sheet.name, cells };
  });
}

describe('agrid-xls', () => {
  it('builds a real OLE/BIFF workbook with multiple worksheets and typed cells', () => {
    const bytes = buildXls([
      {
        name: 'AssetsToImport',
        header: ['HostName', 'Active', 'Amount'],
        rows: [{
          cells: [
            { kind: 'string', value: 'DNBOBSQC' },
            { kind: 'boolean', value: true },
            { kind: 'number', value: 123.5 },
          ],
        }],
      },
      {
        name: 'Instructions',
        header: ['General Instructions:', 'Use only GIDs'],
        rows: [{ cells: [{ kind: 'string', value: 'RecordID' }, { kind: 'string', value: 'Optional' }] }],
      },
    ]);

    expect([...bytes.subarray(0, 8)]).toEqual([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const sheets = parseWorkbook(bytes);
    expect(sheets.map(sheet => sheet.name)).toEqual(['AssetsToImport', 'Instructions']);
    expect(sheets[0].cells).toMatchObject({
      A1: 'HostName',
      B1: 'Active',
      C1: 'Amount',
      A2: 'DNBOBSQC',
      B2: true,
      C2: 123.5,
    });
    expect(sheets[1].cells).toMatchObject({
      A1: 'General Instructions:',
      B1: 'Use only GIDs',
      A2: 'RecordID',
      B2: 'Optional',
    });
  });

  it('sanitizes worksheet names to BIFF limits', () => {
    const [sheet] = parseWorkbook(buildXls([{ name: 'a/b:c'.padEnd(40, 'x'), header: ['A'], rows: [] }]));
    expect(sheet.name.length).toBeLessThanOrEqual(31);
    expect(sheet.name).not.toMatch(/[\\/?*[\]:]/);
  });
});

function forEachRecord(
  bytes: Uint8Array,
  start: number,
  end: number,
  visit: (id: number, data: Uint8Array) => void,
): void {
  for (let pos = start; pos + 4 <= end;) {
    const id = getU16(bytes, pos);
    const length = getU16(bytes, pos + 2);
    const data = bytes.subarray(pos + 4, pos + 4 + length);
    visit(id, data);
    pos += 4 + length;
    if (id === 0x000a && start !== 0) break;
  }
}

function sectorOffset(sectorSize: number, sector: number): number {
  return sectorSize + sector * sectorSize;
}

function shortString(bytes: Uint8Array, offset: number): string {
  const length = bytes[offset];
  const flags = bytes[offset + 1];
  const start = offset + 2;
  return flags & 1
    ? utf16(bytes.subarray(start, start + length * 2))
    : latin1(bytes.subarray(start, start + length));
}

function longString(bytes: Uint8Array, offset: number): { value: string; next: number } {
  const length = getU16(bytes, offset);
  const flags = bytes[offset + 2];
  const start = offset + 3;
  const size = length * (flags & 1 ? 2 : 1);
  return {
    value: flags & 1 ? utf16(bytes.subarray(start, start + size)) : latin1(bytes.subarray(start, start + size)),
    next: start + size,
  };
}

function cellRef(col: number, row: number): string {
  let n = col + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function getU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true);
}

function getU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
}

function utf16(bytes: Uint8Array): string {
  return new TextDecoder('utf-16le').decode(bytes);
}

function latin1(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}
