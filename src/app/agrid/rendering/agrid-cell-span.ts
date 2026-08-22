import { ColDef } from '../agrid.types';
import { getCellValue } from '../agrid.utils';

/** Resolved horizontal layout for one cell within one pane. @internal */
export interface AgridCellSpanLayout {
  covered: boolean;
  span: number;
}

/** Anchor column and width covering a requested pane-local column. @internal */
export interface AgridCellSpanAnchor {
  anchorIndex: number;
  span: number;
}

/** Resolves and sanitizes a configured span without allowing it to leave its pane. @internal */
export function resolveCellSpan<T extends object>(
  col: ColDef<T>,
  row: T,
  originalIndex: number,
  remainingColumns: number,
): number {
  const configured = typeof col.colSpan === 'function'
    ? (col.colSpan as (params: {
        row: T;
        value: unknown;
        column: ColDef<T>;
        originalIndex: number;
      }) => number)({
        row,
        value: getCellValue(col as ColDef, row as Record<string, unknown>, originalIndex),
        column: col,
        originalIndex,
      })
    : col.colSpan;
  const span = Number.isFinite(configured) ? Math.floor(configured as number) : 1;
  return Math.max(1, Math.min(span, remainingColumns));
}

/** Computes whether a pane cell is an anchor or covered by an earlier anchor. @internal */
export function resolveCellSpanLayout<T extends object>(
  columns: readonly ColDef<T>[],
  columnIndex: number,
  row: T,
  originalIndex: number,
): AgridCellSpanLayout {
  if (columnIndex < 0 || columnIndex >= columns.length) return { covered: false, span: 1 };

  const anchor = resolveCellSpanAnchor(columns, columnIndex, row, originalIndex);
  return anchor.anchorIndex === columnIndex
    ? { covered: false, span: anchor.span }
    : { covered: true, span: 1 };
}

/** Finds the rendered anchor that owns a pane-local logical column. @internal */
export function resolveCellSpanAnchor<T extends object>(
  columns: readonly ColDef<T>[],
  columnIndex: number,
  row: T,
  originalIndex: number,
): AgridCellSpanAnchor {
  if (columnIndex < 0 || columnIndex >= columns.length) {
    return { anchorIndex: columnIndex, span: 1 };
  }

  let coveredUntil = 0;
  for (let index = 0; index <= columnIndex;) {
    const span = resolveCellSpan(
      columns[index],
      row,
      originalIndex,
      columns.length - index,
    );
    coveredUntil = index + span;
    if (columnIndex < coveredUntil) return { anchorIndex: index, span };
    index = coveredUntil;
  }
  return { anchorIndex: columnIndex, span: 1 };
}
