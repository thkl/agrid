export interface ColDef {
  field: string;
  header: string;
  width: number;
  type?: 'text' | 'number' | 'date';
  editable?: boolean;
}

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export interface GridEditEvent {
  position: CellPosition;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NewRecord {
  index:number;
  data:Record<string, unknown>
}