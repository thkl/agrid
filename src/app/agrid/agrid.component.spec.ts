import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridComponent } from './agrid.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import { GridItem, NewRecord, RecordEditEvent, RowSelectEvent } from './agrid.types';

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
    sidebarComponent.recordEdit.subscribe(event => emitted.push(event));
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
