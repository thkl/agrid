import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridComponent } from './agrid.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import {
  GridItem,
  NewRecord,
  RecordEditEvent,
  RowSelectEvent,
  RowUpdateEvent,
} from './agrid.types';
import { isDetailRowItem } from './agrid.utils';

describe('AgridComponent grouped control column selection', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  beforeEach(async () => {
    const control = new AgridControl({
      allowRowReorder: false,
      groupByField: 'department',
    });
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name', filterable: true },
        { field: 'department', header: 'Department', groupable: true },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
        { name: 'Carol', department: 'Engineering' },
        { name: 'David', department: 'Engineering' },
      ]),
      control,
      showControlColumn: true,
      rowSelection: 'single',
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
    component.expandGroups();
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('selects and highlights the exact grouped row clicked in the control column', () => {
    const rows = visibleDataRows(component.filteredItems());
    const clicked = rows[2];
    const previous = rows[1];

    component.onControlPointerDown(primaryPointerEvent(), clicked.originalIndex);

    expect(component.selectedRowIndex()).toBe(clicked.originalIndex);
    expect(component.isPinnedPaneRowSelected(clicked)).toBe(true);
    expect(component.isPinnedPaneRowSelected(previous)).toBe(false);
  });

  it('emits the exact grouped row clicked in the control column', () => {
    const clicked = visibleDataRows(component.filteredItems())[2];
    const emitted: (RowSelectEvent | null)[] = [];
    component.rowSelect.subscribe(event => emitted.push(event));

    component.onControlPointerDown(primaryPointerEvent(), clicked.originalIndex);

    expect(emitted).toEqual([{
      rows: [{
        row: provider.datasource.getRow(clicked.originalIndex),
        originalIndex: clicked.originalIndex,
      }],
    }]);
  });

  it('hides row deletion from the control-cell menu when readonly', () => {
    provider.readonlyGrid.set(true);
    component.contextMenu.set({ x: 1, y: 2, rowIndex: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ag-context-item--danger')).toBeNull();
  });
});

describe('AgridComponent Tab navigation', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;

  beforeEach(async () => {
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
      allowAddRows: true,
      autoAddRows: true,
      showSidebar: true,
      showChangedCellIndicator: true,
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('evaluates and emits typed cell info actions', () => {
    const row = provider.datasource.getRow(0);
    const column = {
      field: 'name',
      header: 'Name',
      infoIcon: ({ row: current }: { row: typeof row }) => current.name === 'Alice',
    };
    const emitted: unknown[] = [];
    component.cellInfo.subscribe(event => emitted.push(event));

    expect(component.showCellInfoIcon(column, row)).toBe(true);
    component.onCellInfo(0, column, row);

    expect(emitted).toEqual([{
      row,
      field: 'name',
      value: 'Alice',
      originalIndex: 0,
      column,
    }]);
  });

  it('adds a row when Tab moves past the last cell and keeps focus in the grid', () => {
    const wrapper = fixture.nativeElement.querySelector('.ag-wrapper') as HTMLElement;
    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    wrapper.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    wrapper.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(provider.datasource.length).toBe(2);
    expect(component.selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(document.activeElement).toBe(wrapper);
  });

  it('commits an edited last cell before adding a row on Tab', () => {
    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    component.onStartEdit(0, 1);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-cell-input') as HTMLInputElement;
    input.addEventListener('keydown', event => event.stopPropagation());
    input.value = 'Sales';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    expect(provider.datasource.getRow(0)['department']).toBe('Sales');
    expect(provider.datasource.length).toBe(2);
    expect(component.selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
  });

  it('emits the edited record after its datasource has been updated', async () => {
    const emitted: RecordEditEvent[] = [];
    component.recordEdit.subscribe(event => {
      expect(event.datasource.getRow(event.index)).toEqual(event.data);
      emitted.push(event);
    });
    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    component.onStartEdit(0, 1);
    component.onDraftChange('Sales');

    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    }));

    expect(provider.datasource.getRow(0)).toEqual({ name: 'Alice', department: 'Sales' });
    expect(emitted).toHaveLength(0);
    await Promise.resolve();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      index: 0,
      data: { name: 'Alice', department: 'Sales' },
      provider,
      datasource: provider.datasource,
    });
  });

  it('marks changed cells when enabled and clears markers after persistence', async () => {
    provider.datasource.addRow({ name: 'Bob', department: 'Support' });
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.onStartEdit(0, 0);
    component.onDraftChange('Alicia');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    component.onStartEdit(0, 1);
    component.onDraftChange('Sales');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    }));
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.isCellChanged(0, 'name')).toBe(true);
    expect(component.isCellChanged(0, 'department')).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.ag-cell--changed')).toHaveLength(2);

    component.clearChangedCells(0, ['name']);
    fixture.detectChanges();
    expect(component.isCellChanged(0, 'name')).toBe(false);
    expect(component.isCellChanged(0, 'department')).toBe(true);

    component.clearChangedCells(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.ag-cell--changed')).toHaveLength(0);

    component.selectedCell.set({ rowIndex: 1, colIndex: 0 });
    component.onStartEdit(1, 0);
    component.onDraftChange('Bobby');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    component.clearChangedCells();
    expect(component.isCellChanged(1, 'name')).toBe(false);
  });

  it('does not mark changed cells unless the indicator is enabled', () => {
    const plainProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
    });
    const plainFixture = TestBed.createComponent(AgridComponent);
    plainFixture.componentRef.setInput('provider', plainProvider);
    plainFixture.detectChanges();
    const plainComponent = plainFixture.componentInstance;
    plainComponent.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    plainComponent.onStartEdit(0, 0);
    plainComponent.onDraftChange('Alicia');
    plainComponent.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));

    expect(plainComponent.isCellChanged(0, 'name')).toBe(false);
    plainFixture.destroy();
  });

  it('emits rowChanged once with the latest row after inline editing leaves the row', async () => {
    provider.datasource.addRow({ name: 'Bob', department: 'Support' });
    const emitted: RowUpdateEvent[] = [];
    component.rowChanged.subscribe(event => emitted.push(event));

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.onStartEdit(0, 0);
    component.onDraftChange('Alicia');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.selectedCell()).toEqual({ rowIndex: 0, colIndex: 1 });
    expect(emitted).toHaveLength(0);

    component.onStartEdit(0, 1);
    component.onDraftChange('Sales');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    }));
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.selectedCell()).toEqual({ rowIndex: 1, colIndex: 1 });
    expect(emitted).toEqual([{
      row: { name: 'Alicia', department: 'Sales' },
      originalIndex: 0,
    }]);
  });

  it('emits rowChanged when filter focus clears an edited cell selection', async () => {
    const emitted: RowUpdateEvent[] = [];
    component.rowChanged.subscribe(event => emitted.push(event));
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.onStartEdit(0, 0);
    component.onDraftChange('Alicia');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));

    const filter = document.createElement('input');
    filter.className = 'ag-filter-input';
    component.onGridFocusIn(focusEvent(filter));
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.selectedCell()).toBeNull();
    expect(emitted).toEqual([{
      row: { name: 'Alicia', department: 'Engineering' },
      originalIndex: 0,
    }]);
  });

  it('emits recordEdit for row zero after sidebar-only edits are saved', async () => {
    const sidebarProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
      showSidebar: true,
      useSidebarEditor: true,
    });
    const sidebarFixture = TestBed.createComponent(AgridComponent);
    sidebarFixture.componentRef.setInput('provider', sidebarProvider);
    sidebarFixture.detectChanges();
    const sidebarComponent = sidebarFixture.componentInstance;
    const emitted: RecordEditEvent[] = [];
    const changed: RowUpdateEvent[] = [];
    sidebarComponent.recordEdit.subscribe(event => emitted.push(event));
    sidebarComponent.rowChanged.subscribe(event => changed.push(event));
    sidebarComponent['rowController'].selectedIndices.set(new Set([0]));
    sidebarComponent.commitDetailEdit('department', sidebarProvider.columns()[1], 'Sales');

    sidebarComponent.onSidebarDetailSave([]);

    expect(sidebarProvider.datasource.getRow(0)).toEqual({
      name: 'Alice',
      department: 'Sales',
    });
    expect(emitted).toHaveLength(0);
    await Promise.resolve();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].index).toBe(0);
    expect(emitted[0].data).toEqual({ name: 'Alice', department: 'Sales' });
    expect(emitted[0].provider).toBe(sidebarProvider);
    expect(emitted[0].datasource).toBe(sidebarProvider.datasource);
    expect(changed).toEqual([{
      row: { name: 'Alice', department: 'Sales' },
      originalIndex: 0,
    }]);
    sidebarFixture.destroy();
  });

  it('emits the same provider-aware payload after removing a row', () => {
    const emitted: RecordEditEvent[] = [];
    component.rowRemoved.subscribe(event => emitted.push(event));

    component.deleteRow(0);

    expect(provider.datasource.length).toBe(0);
    expect(emitted).toEqual([{
      index: 0,
      data: { name: 'Alice', department: 'Engineering' },
      provider,
      datasource: provider.datasource,
    }]);
  });

  it('shows an in-row confirmation before deleting an opted-in row', async () => {
    const confirmProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
      confirmRowDelete: true,
    });
    const confirmFixture = TestBed.createComponent(AgridComponent);
    confirmFixture.componentRef.setInput('provider', confirmProvider);
    confirmFixture.detectChanges();
    const confirmComponent = confirmFixture.componentInstance;
    const emitted: RecordEditEvent[] = [];
    confirmComponent.rowRemoved.subscribe(event => emitted.push(event));

    confirmComponent.deleteRow(0);
    confirmFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    confirmFixture.detectChanges();

    const pendingRow = confirmFixture.nativeElement.querySelector(
      '.ag-scroll-pane [data-original-index="0"]',
    ) as HTMLElement;
    const overlay = pendingRow.querySelector('.ag-delete-confirmation') as HTMLElement;
    expect(confirmComponent.pendingDeleteRow()).toBe(0);
    expect(pendingRow.classList.contains('ag-row--pending-delete')).toBe(true);
    expect(overlay.textContent).toContain(confirmComponent.localeText().confirmDeleteRow);
    expect(overlay.textContent).toContain(confirmComponent.localeText().confirmYes);
    expect(overlay.textContent).toContain(confirmComponent.localeText().confirmNo);
    expect(confirmProvider.datasource.length).toBe(1);
    expect(emitted).toEqual([]);

    confirmComponent.cancelRowDelete();

    expect(confirmComponent.pendingDeleteRow()).toBeNull();
    expect(confirmProvider.datasource.length).toBe(1);
    confirmFixture.destroy();
  });

  it('removes the row when its in-row confirmation is accepted', () => {
    const confirmProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
      confirmRowDelete: true,
    });
    const confirmFixture = TestBed.createComponent(AgridComponent);
    confirmFixture.componentRef.setInput('provider', confirmProvider);
    confirmFixture.detectChanges();
    const confirmComponent = confirmFixture.componentInstance;
    const emitted: RecordEditEvent[] = [];
    confirmComponent.rowRemoved.subscribe(event => emitted.push(event));

    confirmComponent.deleteRow(0);
    expect(confirmProvider.datasource.length).toBe(1);

    confirmComponent.confirmPendingRowDelete();

    expect(confirmComponent.pendingDeleteRow()).toBeNull();
    expect(confirmProvider.datasource.length).toBe(0);
    expect(emitted).toEqual([{
      index: 0,
      data: { name: 'Alice', department: 'Engineering' },
      provider: confirmProvider,
      datasource: confirmProvider.datasource,
    }]);
    confirmFixture.destroy();
  });

  it('cancels pending row deletion with Escape', () => {
    const confirmProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
      ]),
      confirmRowDelete: true,
    });
    const confirmFixture = TestBed.createComponent(AgridComponent);
    confirmFixture.componentRef.setInput('provider', confirmProvider);
    confirmFixture.detectChanges();
    const confirmComponent = confirmFixture.componentInstance;
    confirmComponent.deleteRow(0);
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });

    confirmComponent.onKeyDown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(confirmComponent.pendingDeleteRow()).toBeNull();
    expect(confirmProvider.datasource.length).toBe(1);
    confirmFixture.destroy();
  });

  it('closes all open menus with Escape before other Escape behavior', () => {
    component.contextMenu.set({ x: 1, y: 2, rowIndex: 0 });
    component.cellContextMenuState.set({
      x: 3,
      y: 4,
      rowIndex: 0,
      colIndex: 0,
      field: 'name',
      value: 'Alice',
      row: { name: 'Alice', department: 'Engineering' },
    });
    component.groupActionsMenu.set({ x: 5, y: 6, label: 'Engineering' });
    component.filterMenu.set({ field: 'name', x: 7, y: 8 });
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });

    component.onKeyDown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(component.contextMenu()).toBeNull();
    expect(component.cellContextMenuState()).toBeNull();
    expect(component.groupActionsMenu()).toBeNull();
    expect(component.filterMenu()).toBeNull();
  });

  it('closes an open header menu from the document-level Escape hotkey', () => {
    component.filterMenu.set({ field: 'name', x: 7, y: 8 });
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(component.filterMenu()).toBeNull();
  });

  it('identifies the source datasource when multiple grids auto-add rows', async () => {
    const secondProvider = new AgridProvider({
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
      ],
      datasource: new AgridDataSource([{ id: 1, name: 'Alice' }]),
      allowAddRows: true,
      autoAddRows: true,
    });
    const secondFixture = TestBed.createComponent(AgridComponent);
    secondFixture.componentRef.setInput('provider', secondProvider);
    secondFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    secondFixture.detectChanges();
    const secondComponent = secondFixture.componentInstance;
    secondComponent.prepareAddRecord.subscribe(event => {
      expect(event.provider).toBe(secondProvider);
      expect(event.datasource).toBe(secondProvider.datasource);
      event.datasource.patchRow(event.index, { id: event.datasource.length, name: 'New row' });
    });
    secondComponent.selectedCell.set({ rowIndex: 0, colIndex: 1 });

    secondComponent.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    secondFixture.detectChanges();

    expect(provider.datasource.length).toBe(1);
    expect(secondProvider.datasource.getRow(1)).toEqual({ id: 2, name: 'New row' });
    expect(secondFixture.nativeElement.textContent).toContain('2');
    expect(secondFixture.nativeElement.textContent).toContain('New row');
    secondFixture.destroy();
  });

  it('emits prepareAddRecord when auto-add creates the first row in an empty grid', async () => {
    const emptyProvider = new AgridProvider({
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
      ],
      datasource: new AgridDataSource([]),
      allowAddRows: true,
      autoAddRows: true,
    });
    const emptyFixture = TestBed.createComponent(AgridComponent);
    emptyFixture.componentRef.setInput('provider', emptyProvider);
    emptyFixture.detectChanges();
    const emptyComponent = emptyFixture.componentInstance;
    const emitted: NewRecord[] = [];
    emptyComponent.prepareAddRecord.subscribe(event => {
      emitted.push(event);
      event.datasource.patchRow(event.index, { id: 1, name: 'First row' });
    });

    emptyComponent.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    emptyFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    emptyFixture.detectChanges();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].index).toBe(0);
    expect(emptyProvider.datasource.getRow(0)).toEqual({ id: 1, name: 'First row' });
    expect(emptyFixture.nativeElement.textContent).toContain('First row');
    emptyFixture.destroy();
  });

  it('refreshes the virtual viewport when a row is added externally', async () => {
    const viewport = component['viewport']();
    const refreshSpy = vi.spyOn(viewport, 'checkViewportSize');
    provider.control.setPageSize(1);

    provider.datasource.addRow({ name: 'Bob', department: 'Sales' });
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    expect(provider.control.currentPage()).toBe(2);
    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name'])).toEqual(['Bob']);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('pastes into the top-left cell of a multi-cell selection', () => {
    provider.datasource.setData([
      { name: 'Alice', department: 'Engineering' },
      { name: 'Bob', department: 'Sales' },
    ]);
    fixture.detectChanges();
    component.selectedCell.set({ rowIndex: 1, colIndex: 1 });
    component.selectedRange.set({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    });

    component.onPaste(clipboardEvent('Carol\tMarketing\nDavid\tFinance'));

    expect(provider.datasource.rows()).toEqual([
      { name: 'Carol', department: 'Marketing' },
      { name: 'David', department: 'Finance' },
    ]);
    expect(component.selectedRange()).toEqual({
      anchor: { rowIndex: 0, colIndex: 0 },
      focus: { rowIndex: 1, colIndex: 1 },
    });
  });

  it('renders optional row markers and exposes their state', async () => {
    const markingProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
      ]),
      enableRowMarking: true,
    });
    const markingFixture = TestBed.createComponent(AgridComponent);
    markingFixture.componentRef.setInput('provider', markingProvider);
    markingFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    markingFixture.detectChanges();
    const markingComponent = markingFixture.componentInstance;
    const marker = markingFixture.nativeElement.querySelector(
      '.ag-row-marker',
    ) as HTMLInputElement;

    expect(markingComponent.showControlColumn()).toBe(true);
    expect(marker).not.toBeNull();
    marker.click();
    markingFixture.detectChanges();

    expect([...markingComponent.markedRowIndices()]).toEqual([0]);
    expect(markingFixture.nativeElement.querySelector(
      '.ag-scroll-pane [data-original-index="0"]',
    )?.classList.contains('ag-row--marked')).toBe(true);

    markingComponent.clearMarkedRows();
    expect(markingComponent.markedRowIndices().size).toBe(0);
    markingFixture.destroy();
  });

  it('keeps marked rows attached across grid insertions and deletions', () => {
    provider.enableRowMarking = true;
    component.toggleRowMarked(0);

    component.insertRowAt(0);
    expect([...component.markedRowIndices()]).toEqual([1]);

    component.deleteRow(0);
    expect([...component.markedRowIndices()]).toEqual([0]);
  });

  it('renders one grouped header over contiguous columns and updates ARIA rows', async () => {
    const groupedProvider = new AgridProvider({
      columns: [
        { field: 'first', header: 'First', group: 'employee' },
        { field: 'last', header: 'Last', group: 'employee' },
        { field: 'email', header: 'Email' },
      ],
      headerGroups: [{ id: 'employee', label: 'Employee' }],
      datasource: new AgridDataSource([
        { first: 'Alice', last: 'Smith', email: 'alice@example.com' },
      ]),
    });
    const groupedFixture = TestBed.createComponent(AgridComponent);
    groupedFixture.componentRef.setInput('provider', groupedProvider);
    groupedFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    groupedFixture.detectChanges();

    const employeeHeader = groupedFixture.nativeElement.querySelector(
      '.ag-scroll-pane [data-header-group="employee"]',
    ) as HTMLElement;
    expect(employeeHeader.textContent?.trim()).toBe('Employee');
    expect(employeeHeader.style.gridColumn).toBe('span 2');
    expect(groupedFixture.componentInstance.headerRowCount()).toBe(2);
    expect(groupedFixture.nativeElement.querySelector('[role="grid"]')
      .getAttribute('aria-rowcount')).toBe('3');
    expect(groupedFixture.nativeElement.querySelector(
      '.ag-scroll-pane [data-original-index="0"]',
    )?.getAttribute('aria-rowindex')).toBe('3');
    groupedFixture.destroy();
  });
});

describe('AgridComponent server-side filtering', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;

  beforeEach(async () => {
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name', filterable: true },
        { field: 'department', header: 'Department', filterable: true },
      ],
      datasource: new AgridDataSource([
        { name: 'Bob', department: 'Sales' },
        { name: 'Alice', department: 'Engineering' },
      ]),
      serverSideFiltering: true,
      filterDebounceMs: 0,
      sortOption: 'single',
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('emits text filters without filtering local rows', () => {
    const emitted: unknown[] = [];
    component.filterChange.subscribe(event => emitted.push(event));

    component.onTextFilterChange({ target: { value: 'alice' } } as unknown as Event, 'name');

    expect(emitted).toEqual([{ field: 'name', value: 'alice' }]);
    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name']))
      .toEqual(['Bob', 'Alice']);
  });

  it('debounces server-side filter events per column', () => {
    vi.useFakeTimers();
    provider.filterDebounceMs = 300;
    const emitted: unknown[] = [];
    component.filterChange.subscribe(event => emitted.push(event));

    component.onTextFilterChange({ target: { value: 'a' } } as unknown as Event, 'name');
    component.onTextFilterChange({ target: { value: 'alice' } } as unknown as Event, 'name');

    expect(provider.control.getFilter('name').text).toBe('alice');
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(300);

    expect(emitted).toEqual([{ field: 'name', value: 'alice' }]);
    vi.useRealTimers();
  });

  it('emits sort changes without sorting local rows', () => {
    const emitted: unknown[] = [];
    component.sortChange.subscribe(event => emitted.push(event));

    component.filterMenu.set({ field: 'name', x: 0, y: 0 });
    component.onMenuSort('name', 'asc');
    expect(component.filterMenu()).toBeNull();

    component.filterMenu.set({ field: 'name', x: 0, y: 0 });
    component.onMenuSort('name', 'asc');

    expect(emitted).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: null },
    ]);
    expect(component.filterMenu()).toBeNull();
    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name']))
      .toEqual(['Bob', 'Alice']);
  });

  it('clears the previous sort when single sorting switches columns', () => {
    const emitted: unknown[] = [];
    component.sortChange.subscribe(event => emitted.push(event));

    component.onMenuSort('name', 'asc');
    component.onMenuSort('department', 'desc');

    expect(provider.control.sortOrder()).toEqual(['department']);
    expect(provider.control.getFilter('name').sort).toBeNull();
    expect(emitted).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: null },
      { field: 'department', direction: 'desc' },
    ]);
  });

  it('hides and disables sorting when sortOption is none', () => {
    provider = new AgridProvider({
      columns: provider.columns(),
      datasource: provider.datasource,
      control: new AgridControl(),
      serverSideFiltering: true,
      filterDebounceMs: 0,
      sortOption: 'none',
    });
    fixture.componentRef.setInput('provider', provider);
    component.filterMenu.set({ field: 'name', x: 0, y: 0 });
    fixture.detectChanges();

    const menuText = fixture.nativeElement.querySelector('.ag-filter-menu')?.textContent ?? '';
    expect(menuText).not.toContain(component.localeText().sortAscending);
    expect(menuText).not.toContain(component.localeText().sortDescending);

    component.onMenuSort('name', 'asc');
    expect(provider.control.sortOrder()).toEqual([]);
  });

  it('hides the Excel-style value picker', () => {
    component.filterMenu.set({ field: 'name', x: 0, y: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ag-filter-menu-values')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ag-filter-menu-search')).toBeNull();
  });
});

describe('AgridComponent aggregates and accessibility', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;
  let control: AgridControl;

  beforeEach(async () => {
    control = new AgridControl();
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name', width: 120, filterable: true },
        { field: 'amount', header: 'Amount', width: 100, type: 'number' },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', amount: 10 },
        { name: 'Bob', amount: 20 },
      ]),
      control,
      rowSelection: 'multi',
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('renders aggregates configured through AgridControl', () => {
    control.setAggregate('amount', 'sum');
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('.ag-footer') as HTMLElement;
    expect(footer.textContent).toContain('Σ');
    expect(footer.textContent).toContain('30');
  });

  it('exposes grid structure, state, controls, and menus to assistive technology', () => {
    control.setSort('name', 'asc');
    control.setPageSize(1);
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.contextMenu.set({ x: 0, y: 0, rowIndex: 0 });
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.ag-wrapper') as HTMLElement;
    expect(grid.getAttribute('role')).toBe('grid');
    expect(grid.getAttribute('aria-label')).toBe(component.localeText().grid);
    expect(grid.getAttribute('aria-colcount')).toBe('2');
    expect(grid.getAttribute('aria-rowcount')).toBe('2');
    expect(grid.getAttribute('aria-multiselectable')).toBe('true');

    const nameHeader = fixture.nativeElement.querySelector(
      '[role="columnheader"][data-col-field="name"]',
    ) as HTMLElement;
    expect(nameHeader.getAttribute('aria-colindex')).toBe('1');
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');

    const selectedCell = fixture.nativeElement.querySelector(
      'agrid-cell[data-cell-row="0"][data-cell-col="0"]',
    ) as HTMLElement;
    expect(selectedCell.getAttribute('role')).toBe('gridcell');
    expect(selectedCell.getAttribute('aria-colindex')).toBe('1');
    expect(selectedCell.getAttribute('aria-selected')).toBe('true');

    const resizeHandle = nameHeader.querySelector('[role="separator"]') as HTMLElement;
    resizeHandle.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }));
    fixture.detectChanges();
    expect(resizeHandle.getAttribute('aria-valuenow')).toBe('130');

    const pagination = fixture.nativeElement.querySelector('nav.ag-pagination') as HTMLElement;
    expect(pagination.getAttribute('aria-label')).toBe(component.localeText().pagination);
    expect(pagination.querySelector('button')?.getAttribute('aria-label'))
      .toBe(component.localeText().firstPage);
    expect(fixture.nativeElement.querySelector('.ag-context-menu')?.getAttribute('role'))
      .toBe('menu');
    expect(fixture.nativeElement.querySelector('.ag-context-item')?.getAttribute('role'))
      .toBe('menuitem');
  });
});

function visibleDataRows(
  items: GridItem[],
): { row: Record<string, unknown>; originalIndex: number }[] {
  return items.filter(
    (item): item is { row: Record<string, unknown>; originalIndex: number } =>
      typeof item === 'object' && item !== null && 'row' in item,
  );
}

function primaryPointerEvent(): PointerEvent {
  return {
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
  } as unknown as PointerEvent;
}

function clipboardEvent(text: string): ClipboardEvent {
  return {
    clipboardData: {
      getData: () => text,
    },
    preventDefault: () => undefined,
  } as unknown as ClipboardEvent;
}

function focusEvent(target: Element): FocusEvent {
  const event = new FocusEvent('focusin');
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('AgridComponent tree mode', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;
  let provider: AgridProvider;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  beforeEach(async () => {
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'size', header: 'Size', type: 'number' },
      ],
      datasource: new AgridDataSource([
        { id: 1, parentId: null, name: 'Root', size: 0 },
        { id: 2, parentId: 1, name: 'Child A', size: 5 },
        { id: 3, parentId: 1, name: 'Child B', size: 7 },
        { id: 4, parentId: 2, name: 'Grandchild', size: 9 },
        { id: 5, parentId: null, name: 'Root B', size: 3 },
      ]),
      treeConfig: {
        getId: (r: any) => r.id,
        getParentId: (r: any) => r.parentId,
        treeField: 'name',
      },
      masterDetail: true,
      detailRenderer: ({ row }) => `<b>${row.name}</b>`,
    });

    await TestBed.configureTestingModule({
      imports: [AgridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  const visibleNames = () =>
    component.displayItems()
      .filter(isTreeRow)
      .map(item => (item as { row: Record<string, unknown> }).row['name']);

  it('shows only root rows when nothing is expanded', () => {
    expect(visibleNames()).toEqual(['Root', 'Root B']);
    expect(component.showPagination()).toBe(false);
  });

  it('marks expandable rows and disables pagination', () => {
    const items = component.displayItems().filter(isTreeRow);
    const root = items.find(i => (i as any).row.name === 'Root')!;
    const rootB = items.find(i => (i as any).row.name === 'Root B')!;
    expect(component.treeRowExpandable(root)).toBe(true);
    expect(component.treeRowExpandable(rootB)).toBe(false);
  });

  it('offers master/detail only on tree leaves', () => {
    const items = component.displayItems().filter(isTreeRow);
    const root = items.find(i => (i as any).row.name === 'Root')!;
    const rootB = items.find(i => (i as any).row.name === 'Root B')!;

    expect(component.masterDetail()).toBe(true);
    expect(component.canToggleDetail(root)).toBe(false);
    expect(component.canToggleDetail(rootB)).toBe(true);
  });

  it('expands detail panels beneath tree leaves and rejects parent rows', () => {
    component.toggleDetail(0);
    component.toggleDetail(4);
    fixture.detectChanges();

    expect(component.isDetailExpanded(0)).toBe(false);
    expect(component.isDetailExpanded(4)).toBe(true);
    const items = component.displayItems();
    const detail = items.find(isDetailRowItem);
    expect(detail?.detailFor).toBe(4);
    expect(component.detailHtml(detail!)).toContain('Root B');
    expect(component.itemSizes()).toContain(component.detailRowHeight());
  });

  it('expands a node via its twisty click and reveals children', () => {
    const root = component.displayItems()
      .filter(isTreeRow)
      .find(i => (i as any).row.name === 'Root')!;
    component.onTreeToggle(root);
    fixture.detectChanges();

    expect(component.treeController.isExpanded(1)).toBe(true);
    expect(visibleNames()).toEqual(['Root', 'Child A', 'Child B', 'Root B']);
  });

  it('toggles an expandable readonly tree cell with Ctrl+Enter', () => {
    provider.readonlyGrid.set(true);
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });

    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      cancelable: true,
    }));
    fixture.detectChanges();

    expect(component.treeController.isExpanded(1)).toBe(true);
    expect(visibleNames()).toEqual(['Root', 'Child A', 'Child B', 'Root B']);

    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      cancelable: true,
    }));
    fixture.detectChanges();

    expect(component.treeController.isExpanded(1)).toBe(false);
    expect(visibleNames()).toEqual(['Root', 'Root B']);
  });

  it('toggles an expandable editable tree cell with Cmd+Enter', () => {
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });

    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      cancelable: true,
    }));

    expect(component.isEditing(0, 0)).toBe(false);
    expect(component.treeController.isExpanded(1)).toBe(true);
  });

  it('keeps plain Enter editing behavior for editable tree cells', () => {
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });

    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    }));

    expect(component.isEditing(0, 0)).toBe(true);
    expect(component.treeController.isExpanded(1)).toBe(false);
  });

  it('finds collapsed descendants without returning focus to the selected cell', () => {
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });

    component.openFind();
    component.onFindInput('Grandchild');

    expect(component.selectedCell()).toBeNull();
    expect(component.findMatches()).toEqual([{ rowIndex: 3, colIndex: 0 }]);
    expect(visibleNames()).toEqual(['Root', 'Root B']);

    component.goToFindMatch(1);
    fixture.detectChanges();

    expect(component.selectedCell()).toEqual({ rowIndex: 3, colIndex: 0 });
    expect(component.treeController.isExpanded(1)).toBe(true);
    expect(component.treeController.isExpanded(2)).toBe(true);
    expect(visibleNames()).toEqual(['Root', 'Child A', 'Grandchild', 'Child B', 'Root B']);
  });

  it('renders the twisty inside the tree column cell', () => {
    component.onTreeToggle(
      component.displayItems().filter(isTreeRow).find(i => (i as any).row.name === 'Root')!,
    );
    fixture.detectChanges();

    const treeCells = fixture.nativeElement.querySelectorAll(
      'agrid-cell[data-col-field="name"].ag-cell--tree',
    );
    expect(treeCells.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.ag-tree-twisty')).not.toBeNull();
  });

  it('expands and collapses the whole tree', () => {
    component.expandAllNodes();
    fixture.detectChanges();
    expect(visibleNames()).toEqual(['Root', 'Child A', 'Grandchild', 'Child B', 'Root B']);

    component.collapseAllNodes();
    fixture.detectChanges();
    expect(visibleNames()).toEqual(['Root', 'Root B']);
  });

  it('indents deeper rows by level', () => {
    component.expandAllNodes();
    fixture.detectChanges();
    const items = component.displayItems().filter(isTreeRow);
    const grandchild = items.find(i => (i as any).row.name === 'Grandchild')!;
    expect(component.treeRowLevel(grandchild)).toBe(2);
  });
});

function isTreeRow(item: GridItem): boolean {
  return typeof item === 'object' && item !== null && 'level' in item;
}

describe('AgridComponent path tree mode', () => {
  it('renders generated branches while editing leaves with their original path value', async () => {
    const provider = new AgridProvider({
      columns: [{ field: 'oz', header: 'OZ' }],
      datasource: new AgridDataSource([
        { oz: '01.01.0001' },
        { oz: '01.01.0002' },
        { oz: '01.02.0001' },
      ]),
      treeConfig: {
        getPath: row => row.oz.split('.'),
        treeField: 'oz',
      },
    });
    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.expandAllNodes();
    fixture.detectChanges();

    expect(component.displayItems().filter(component.isPathTreeNodeItem).length).toBe(3);
    const firstLeaf = component.displayItems()
      .find(item => isTreeRow(item) && (item as any).originalIndex === 0)!;
    expect(component.treeCellDisplayOverride(firstLeaf, { field: 'oz', header: 'OZ' }))
      .toBe('0001');

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.onStartEdit(0, 0);

    expect(component.currentDraft()).toBe('01.01.0001');
    fixture.destroy();
  });
});

describe('AgridComponent pinned rows and master/detail', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  beforeEach(async () => {
    const provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'kind', header: 'Kind' },
      ],
      datasource: new AgridDataSource([
        { name: 'Row 0', kind: 'data' },
        { name: 'Row 1', kind: 'data' },
        { name: 'Summary', kind: 'summary' },
      ]),
      control: new AgridControl({ allowRowReorder: false }),
      getRowClass: ({ row }) => (row['kind'] === 'summary' ? 'is-summary' : ''),
      pinRow: row => (row['kind'] === 'summary' ? 'bottom' : undefined),
      masterDetail: true,
      detailRenderer: ({ row }) => `<b>${row['name']}</b>`,
    });

    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  it('pins predicate rows and keeps them out of the body', () => {
    expect(component.pinnedBottomItems().map(i => i.row['name'])).toEqual(['Summary']);
    expect(component.displayItems().some(i => typeof i === 'object' && i !== null && (i as any).row?.name === 'Summary'))
      .toBe(false);
  });

  it('lets the UI pin and unpin rows by original index', () => {
    component.pinRowTo(0, 'top');
    fixture.detectChanges();
    expect(component.pinnedTopItems().map(i => i.row['name'])).toEqual(['Row 0']);
    expect(component.rowPinState(0)).toBe('top');

    // A runtime override beats the predicate: unpin the summary row.
    component.pinRowTo(2, null);
    fixture.detectChanges();
    expect(component.rowPinState(2)).toBeUndefined();
    expect(component.pinnedBottomItems()).toEqual([]);
  });

  it('expands a master/detail panel and sizes it via itemSizes', () => {
    component.toggleDetail(0);
    fixture.detectChanges();
    expect(component.isDetailExpanded(0)).toBe(true);
    expect(component.detailHtml({ detailFor: 0, row: { name: 'Row 0' } })).toContain('Row 0');
    // the detail item contributes a taller entry to the virtual-scroll size array
    expect(component.itemSizes().some(h => h === component.detailRowHeight())).toBe(true);
  });

  it('resolves whole-row CSS classes from getRowClass', () => {
    expect(component.getRowClass({ kind: 'summary' }, 2)).toBe('is-summary');
    expect(component.getRowClass({ kind: 'data' }, 0)).toBe('');
  });
});
