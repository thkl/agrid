import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { AgridCellComponent } from './agrid-cell.component';
import { AgridDataSource } from './agrid-datasource';
import { CellPosition, ColDef, GridEditEvent, NewRecord } from './agrid.types';

@Component({
  selector: 'agrid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, AgridCellComponent],
  templateUrl: './agrid.component.html',
  styleUrl: './agrid.component.css',
})
export class AgridComponent {
  colDefs = input.required<ColDef[]>();
  rowHeight = input<number>(32);
  dataSource = input.required<AgridDataSource>();
  allowAddRows = input<boolean>(false);
  autoAddRows = input<boolean>(false);
  cellEdit = output<GridEditEvent>();
  prepareAddRecord = output<NewRecord>();

  readonly selectedCell = signal<CellPosition | null>(null);
  readonly editingCell = signal<CellPosition | null>(null);
  readonly currentDraft = signal<unknown>(null);
  readonly editSeedChar = signal<string>('');

  readonly gridTemplateColumns = computed(() =>
    this.colDefs().map(c => `${c.width}px`).join(' ')
  );

  readonly totalWidth = computed(() =>
    this.colDefs().reduce((sum, c) => sum + c.width, 0)
  );

  // null sentinel at the end represents the "+ Add row" placeholder.
  // Hidden when autoAddRows is on (implicit mode, no button needed).
  readonly displayRows = computed<(Record<string, unknown> | null)[]>(() =>
    this.allowAddRows() && !this.autoAddRows()
      ? [...this.dataSource().rows(), null]
      : this.dataSource().rows()
  );

  private readonly viewport = viewChild.required(CdkVirtualScrollViewport);
  private readonly wrapperEl = viewChild.required<ElementRef<HTMLDivElement>>('wrapper');

  isSelected(ri: number, ci: number): boolean {
    const sel = this.selectedCell();
    return sel?.rowIndex === ri && sel?.colIndex === ci;
  }

  isEditing(ri: number, ci: number): boolean {
    const ed = this.editingCell();
    return ed?.rowIndex === ri && ed?.colIndex === ci;
  }

  getSeedChar(ri: number, ci: number): string {
    return this.isEditing(ri, ci) ? this.editSeedChar() : '';
  }

  isAddRowSelected(ri: number): boolean {
    return this.allowAddRows() && this.selectedCell()?.rowIndex === ri;
  }

  onActivate(ri: number, ci: number): void {
    this.cancelCurrent();
    this.selectedCell.set({ rowIndex: ri, colIndex: ci });
    this.wrapperEl().nativeElement.focus();
  }

  onActivateAddRow(_ri: number): void {
    this.cancelCurrent();
    this.activateAddRow();
  }

  onStartEdit(ri: number, ci: number): void {
    this.enterEdit(ri, ci, '');
  }

  onDraftChange(value: unknown): void {
    this.currentDraft.set(value);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.editingCell()) {
      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          this.commitCurrent();
          this.moveSelection(0, event.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          event.preventDefault();
          this.commitCurrent();
          this.moveSelection(1, 0);
          break;
        case 'Escape':
          event.preventDefault();
          this.cancelCurrent();
          this.wrapperEl().nativeElement.focus();
          break;
      }
      return;
    }

    const sel = this.selectedCell();
    const ds = this.dataSource();
    const onAddRow = this.allowAddRows() && !this.autoAddRows() && sel?.rowIndex === ds.length;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveSelection(0, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.moveSelection(0, 1);
        break;
      case 'Tab':
        event.preventDefault();
        this.moveSelection(0, event.shiftKey ? -1 : 1);
        break;
      case 'Enter':
      case 'F2':
        event.preventDefault();
        if (sel) {
          if (onAddRow) this.activateAddRow();
          else this.enterEdit(sel.rowIndex, sel.colIndex, '');
        }
        break;
      default:
        if (sel && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (onAddRow) this.activateAddRow();
          else this.enterEdit(sel.rowIndex, sel.colIndex, event.key);
        }
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  private buildEmptyRow(): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const col of this.colDefs()) {
      row[col.field] = col.type === 'number' ? 0 : '';
    }
    return row;
  }

  private activateAddRow(): void {
    const emptyRow = this.buildEmptyRow();
    const insertedIndex = this.dataSource().addRow(emptyRow);
    this.selectedCell.set({ rowIndex: insertedIndex, colIndex: 0 });
    this.wrapperEl().nativeElement.focus();
    this.scrollToKeepVisible(insertedIndex);
    this.prepareAddRecord.emit({ index: insertedIndex, data: emptyRow });
  }

  private enterEdit(ri: number, ci: number, seedChar: string): void {
    const col = this.colDefs()[ci];
    if (col.editable === false) return;
    const currentValue = this.dataSource().getRow(ri)[col.field];
    this.selectedCell.set({ rowIndex: ri, colIndex: ci });
    this.currentDraft.set(seedChar !== '' ? seedChar : currentValue);
    this.editSeedChar.set(seedChar);
    this.editingCell.set({ rowIndex: ri, colIndex: ci });
    this.scrollToKeepVisible(ri);
  }

  private commitCurrent(): void {
    const pos = this.editingCell();
    if (!pos) return;
    const col = this.colDefs()[pos.colIndex];
    const oldValue = this.dataSource().getRow(pos.rowIndex)[col.field];
    const newValue = this.currentDraft();

    if (oldValue !== newValue) {
      this.dataSource().patchRow(pos.rowIndex, { [col.field]: newValue });
      this.cellEdit.emit({ position: pos, field: col.field, oldValue, newValue });
    }

    this.editingCell.set(null);
    this.editSeedChar.set('');
    this.wrapperEl().nativeElement.focus();
  }

  private cancelCurrent(): void {
    this.editingCell.set(null);
    this.editSeedChar.set('');
  }

  private moveSelection(dRow: number, dCol: number): void {
    const dataLen = this.dataSource().length;
    const hasAddPlaceholder = this.allowAddRows() && !this.autoAddRows();
    if (dataLen === 0 && !hasAddPlaceholder && !this.autoAddRows()) return;

    const sel = this.selectedCell() ?? { rowIndex: 0, colIndex: 0 };
    const cols = this.colDefs().length;
    const maxRow = dataLen - 1 + (hasAddPlaceholder ? 1 : 0);

    let newRow = sel.rowIndex + dRow;
    let newCol = sel.colIndex + dCol;

    // Column wrap — but not for the add row placeholder
    const onAddRow = hasAddPlaceholder && newRow === dataLen;
    if (!onAddRow) {
      if (newCol < 0) { newRow--; newCol = cols - 1; }
      if (newCol >= cols) { newRow++; newCol = 0; }
    }

    // autoAddRows: navigating past the last real row adds a blank row immediately
    if (this.autoAddRows() && newRow >= dataLen) {
      const emptyRow = this.buildEmptyRow();
      const insertedIndex = this.dataSource().addRow(emptyRow);
      this.selectedCell.set({ rowIndex: insertedIndex, colIndex: Math.min(newCol, cols - 1) });
      this.scrollToKeepVisible(insertedIndex);
      this.wrapperEl().nativeElement.focus();
      this.prepareAddRecord.emit({ index: insertedIndex, data: emptyRow });
      return;
    }

    newRow = Math.max(0, Math.min(maxRow, newRow));
    newCol = Math.max(0, Math.min(cols - 1, newCol));

    // Add row placeholder has no columns — keep colIndex 0
    if (hasAddPlaceholder && newRow === dataLen) {
      newCol = 0;
    }

    this.selectedCell.set({ rowIndex: newRow, colIndex: newCol });
    this.scrollToKeepVisible(newRow);
  }

  private scrollToKeepVisible(rowIndex: number): void {
    const viewport = this.viewport();
    const itemSize = this.rowHeight();
    const scrollOffset = viewport.measureScrollOffset();
    const viewportSize = viewport.getViewportSize();

    if (rowIndex * itemSize < scrollOffset) {
      viewport.scrollToOffset(rowIndex * itemSize);
    } else if ((rowIndex + 1) * itemSize > scrollOffset + viewportSize) {
      viewport.scrollToOffset((rowIndex + 1) * itemSize - viewportSize);
    }
  }
}
