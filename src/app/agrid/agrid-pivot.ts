import { AgridAggregate, AgridPivotConfig, ColDef } from './agrid.types';
import { getDisplayForField } from './agrid.utils';

/** Derived rows and columns consumed by the normal grid pipeline in pivot mode. @internal */
export interface AgridPivotResult {
  rows: Record<string, unknown>[];
  columns: ColDef[];
}

/** Apply one supported aggregate to the raw values in a pivot bucket. */
function aggregatePivotValues(values: unknown[], aggregate: AgridAggregate): unknown {
  if (typeof aggregate === 'function') return aggregate(values);
  if (aggregate === 'count') {
    return values.reduce<number>(
      (count, value) => count + (value != null && value !== '' ? 1 : 0),
      0,
    );
  }

  const numeric = values
    .map(value => Number(value))
    .filter(value => !Number.isNaN(value));
  if (aggregate === 'sum') return numeric.reduce((sum, value) => sum + value, 0);
  if (numeric.length === 0) return null;
  if (aggregate === 'avg') {
    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }
  let result = numeric[0];
  for (let index = 1; index < numeric.length; index++) {
    result = aggregate === 'min'
      ? Math.min(result, numeric[index])
      : Math.max(result, numeric[index]);
  }
  return result;
}

/**
 * Convert flat datasource rows into a read-only cross-tabulation.
 *
 * Distinct row and column values retain their raw identity while their configured column
 * formatters supply labels. Generated field names are private implementation keys, avoiding
 * collisions with source fields. Empty intersections are represented by `null`.
 */
export function buildPivotResult<T extends object>(
  rows: T[],
  sourceColumns: ColDef<T>[],
  config: AgridPivotConfig<T>,
  locale?: string,
): AgridPivotResult {
  // ColDef is deliberately row-type invariant because callback parameters contain T. Pivoting
  // reads only display metadata, so normalize definitions to the renderer's untyped view here.
  const normalizedColumns = sourceColumns as unknown as ColDef[];
  const columnMap = new Map(normalizedColumns.map(column => [column.field, column]));
  const rowColumn = columnMap.get(config.rowField);
  const pivotColumn = columnMap.get(config.columnField);
  const valueColumn = columnMap.get(config.valueField);
  if (!rowColumn || !pivotColumn || !valueColumn) {
    throw new Error('Pivot rowField, columnField, and valueField must reference configured columns.');
  }

  const buckets = new Map<unknown, Map<unknown, unknown[]>>();
  const rowLabels = new Map<unknown, string>();
  const columnLabels = new Map<unknown, string>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const rowValue = record[config.rowField];
    const columnValue = record[config.columnField];
    rowLabels.set(rowValue, getDisplayForField(rowColumn, rowValue, locale));
    columnLabels.set(columnValue, getDisplayForField(pivotColumn, columnValue, locale));
    let columns = buckets.get(rowValue);
    if (!columns) {
      columns = new Map();
      buckets.set(rowValue, columns);
    }
    const values = columns.get(columnValue);
    if (values) values.push(record[config.valueField]);
    else columns.set(columnValue, [record[config.valueField]]);
  }

  const byLabel = (labels: Map<unknown, string>) =>
    ([a]: [unknown, unknown], [b]: [unknown, unknown]) =>
      (labels.get(a) ?? '').localeCompare(labels.get(b) ?? '', locale, { sensitivity: 'base' });
  const pivotValues = [...columnLabels.entries()].sort(byLabel(columnLabels)).map(([value]) => value);
  const rowValues = [...rowLabels.entries()].sort(byLabel(rowLabels)).map(([value]) => value);
  const aggregate = config.aggregate ?? 'sum';

  const columns: ColDef[] = [
    { ...rowColumn, editable: false, aggregate: undefined },
    ...pivotValues.map((value, index): ColDef => ({
      field: `__agrid_pivot_${index}`,
      header: columnLabels.get(value) ?? String(value ?? ''),
      type: valueColumn.type,
      width: valueColumn.width,
      // A count describes bucket cardinality rather than the source value's unit (for example
      // dollars), so carrying a currency/percentage formatter onto it would be misleading.
      formatter: aggregate === 'count'
        ? undefined
        : valueColumn.formatter as ((value: any) => string) | undefined,
      editable: false,
    })),
  ];

  const pivotRows = rowValues.map(rowValue => {
    const result: Record<string, unknown> = { [config.rowField]: rowValue };
    pivotValues.forEach((columnValue, index) => {
      const values = buckets.get(rowValue)?.get(columnValue);
      result[`__agrid_pivot_${index}`] = values
        ? aggregatePivotValues(values, aggregate)
        : null;
    });
    return result;
  });

  return { rows: pivotRows, columns };
}
