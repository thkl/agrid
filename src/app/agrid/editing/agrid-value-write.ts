import { AgridDataSource } from '../agrid-datasource';
import { AgridValueWriteSource, ColDef, GridEditEvent, ValueOption } from '../agrid.types';
import { coerceDateInputValue, coerceNumberInputValue, getCellValue } from '../agrid.utils';

export interface AgridPreparedValue {
  oldValue: unknown;
  newValue: unknown;
}

export interface AgridCellWriteResult extends AgridPreparedValue {
  changed: boolean;
}

export function prepareCellValue(
  col: ColDef,
  row: Record<string, unknown>,
  originalIndex: number,
  rawValue: unknown,
  source: AgridValueWriteSource,
): AgridPreparedValue {
  const oldValue = getCellValue(col, row, originalIndex);
  let newValue = coerceColumnValue(col, rawValue, row[col.field]);
  if (col.valueParser) {
    newValue = col.valueParser({
      row,
      value: newValue,
      oldValue,
      column: col,
      originalIndex,
      source,
    });
  }
  return { oldValue, newValue };
}

export function writeCellValue(
  dataSource: AgridDataSource,
  rowIndex: number,
  col: ColDef,
  value: unknown,
  source: AgridValueWriteSource,
): AgridCellWriteResult {
  const row = dataSource.getRow(rowIndex);
  const { oldValue, newValue } = prepareCellValue(col, row, rowIndex, value, source);
  return applyPreparedCellValue(dataSource, rowIndex, col, oldValue, newValue, source);
}

export function applyPreparedCellValue(
  dataSource: AgridDataSource,
  rowIndex: number,
  col: ColDef,
  oldValue: unknown,
  newValue: unknown,
  source: AgridValueWriteSource,
): AgridCellWriteResult {
  const row = dataSource.getRow(rowIndex);
  if (oldValue === newValue) return { oldValue, newValue, changed: false };

  if (col.valueSetter) {
    const patch = col.valueSetter({
      row,
      value: newValue,
      oldValue,
      column: col,
      originalIndex: rowIndex,
      source,
    });
    if (patch === false) return { oldValue, newValue, changed: false };
    if (patch && typeof patch === 'object') {
      dataSource.patchRow(rowIndex, patch);
    } else if (!col.valueGetter) {
      dataSource.patchRow(rowIndex, { [col.field]: newValue });
    } else {
      return { oldValue, newValue, changed: false };
    }
  } else {
    dataSource.patchRow(rowIndex, { [col.field]: newValue });
  }

  return { oldValue, newValue, changed: true };
}

export function cellEditEvent(
  rowIndex: number,
  colIndex: number,
  field: string,
  oldValue: unknown,
  newValue: unknown,
): GridEditEvent {
  return {
    position: { rowIndex, colIndex },
    field,
    oldValue,
    newValue,
  } as GridEditEvent;
}

function coerceColumnValue(
  col: ColDef,
  value: unknown,
  oldFieldValue: unknown,
): unknown {
  if (col.values?.length) {
    const option = col.values.find(item =>
      typeof item === 'string'
        ? item === value
        : item.label === value || String((item as ValueOption).value) === String(value)
    );
    if (option !== undefined) return typeof option === 'string' ? option : (option as ValueOption).value;
  }
  if (col.type === 'number') return coerceNumberInputValue(value);
  if (col.type === 'date') return coerceDateInputValue(String(value), oldFieldValue);
  return value;
}
