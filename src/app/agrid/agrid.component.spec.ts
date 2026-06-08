import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgridComponent } from './agrid.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import { GridItem, RowSelectEvent } from './agrid.types';

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

    component.onMenuSort('name', 'asc');
    component.onMenuSort('name', 'asc');

    expect(emitted).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: null },
    ]);
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
