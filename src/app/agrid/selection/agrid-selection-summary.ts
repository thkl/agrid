import { AgridSelectionSummary, ColDef, GridItem } from '../agrid.types';
import { isDataRowItem } from '../agrid.utils';

/** Rectangular selection in projected-row and visible-column coordinates. @internal */
export interface AgridSelectionSummaryBounds {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

/** Computes spreadsheet-style statistics from numeric cells in a visible selection. @internal */
export function computeSelectionSummary(
  items: readonly GridItem[],
  columns: readonly ColDef[],
  bounds: AgridSelectionSummaryBounds | null,
): AgridSelectionSummary | null {
  if (!bounds) return null;

  const values: number[] = [];
  for (let rowIndex = bounds.rowStart; rowIndex <= bounds.rowEnd; rowIndex++) {
    const item = items[rowIndex];
    if (!isDataRowItem(item)) continue;

    for (let colIndex = bounds.colStart; colIndex <= bounds.colEnd; colIndex++) {
      const column = columns[colIndex];
      if (!column) continue;
      const raw = item.row[column.field];
      const numeric = typeof raw === 'number'
        ? raw
        : column.type === 'number' && raw !== '' && raw != null
          ? Number(raw)
          : Number.NaN;
      if (Number.isFinite(numeric)) values.push(numeric);
    }
  }

  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    count: values.length,
    sum,
    average: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
