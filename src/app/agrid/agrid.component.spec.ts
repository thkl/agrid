import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AgridComponent } from './agrid.component';
import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import { AgridBrowserAdapter } from './infrastructure/agrid-browser.adapter';
import {
  GridEditEvent,
  GridItem,
  NewRecord,
  RecordEditEvent,
  RowSelectEvent,
  TreeNodeClickEvent,
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

  it('exports every filtered row via the provider even when groups are collapsed', () => {
    // Regression: export read the rendered projection, so collapsed groups (no child data rows
    // on screen) produced an empty file. It must export the full filtered/sorted set instead.
    component.collapseGroups();
    fixture.detectChanges();

    const download = vi.spyOn(AgridBrowserAdapter.prototype, 'downloadText').mockReturnValue(true);
    try {
      provider.exportCsv();
      expect(download).toHaveBeenCalledTimes(1);
      const csv = download.mock.calls[0][1];
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Name,Department');
      expect(lines).toHaveLength(5); // header + all 4 data rows
      for (const name of ['Alice', 'Bob', 'Carol', 'David']) expect(csv).toContain(name);
    } finally {
      download.mockRestore();
    }
  });

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

  it('returns the current selected row', () => {
    expect(component.getCurrentRow()).toBeNull();

    component.onControlPointerDown(primaryPointerEvent(), 2);

    expect(component.getCurrentRow()).toEqual({
      row: provider.datasource.getRow(2),
      originalIndex: 2,
    });
  });

  it('returns and emits the current selected cell', () => {
    const emitted: unknown[] = [];
    component.cellSelect.subscribe(event => emitted.push(event));

    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    fixture.detectChanges();

    expect(component.getCurrentCell()).toMatchObject({
      position: { rowIndex: 0, colIndex: 1 },
      row: provider.datasource.getRow(0),
      originalIndex: 0,
      field: 'department',
      value: 'Engineering',
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      position: { rowIndex: 0, colIndex: 1 },
      field: 'department',
      value: 'Engineering',
    });

    component.selectedCell.set(null);
    fixture.detectChanges();

    expect(component.getCurrentCell()).toBeNull();
    expect(emitted).toHaveLength(2);
    expect(emitted[1]).toBeNull();
  });

  it('renders an optional formula bar and commits the selected cell raw value', () => {
    provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'score', header: 'Score', type: 'number' },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', score: 1 },
      ]),
      control: new AgridControl(),
      showFormulaBar: true,
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-formula-bar-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('1');

    const edits: GridEditEvent[] = [];
    component.cellEdit.subscribe(event => edits.push(event));
    input.value = '42';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(provider.datasource.getRow(0)['score']).toBe(42);
    expect(edits.at(-1)).toMatchObject({ field: 'score', oldValue: 1, newValue: 42 });
  });

  it('keeps formula bar typing out of grid keyboard navigation', () => {
    provider = new AgridProvider({
      columns: [{ field: 'name', header: 'Name' }],
      datasource: new AgridDataSource([{ name: 'Alice' }]),
      control: new AgridControl(),
      showFormulaBar: true,
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    fixture.detectChanges();

    const navigation = component['navigationController'] as unknown as {
      handleKeyDown: (event: KeyboardEvent) => void;
    };
    const handleKeyDown = vi.spyOn(navigation, 'handleKeyDown');
    const input = fixture.nativeElement.querySelector('.ag-formula-bar-input') as HTMLInputElement;

    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }));
    input.value = 'Alicia';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(handleKeyDown).not.toHaveBeenCalled();
    expect(component.formulaBarDraft()).toBe('Alicia');
    expect(document.activeElement).toBe(input);
  });

  it('commits formula bar blur edits to the cell that owned focus', () => {
    provider = new AgridProvider({
      columns: [
        { field: 'budget', header: 'Budget', editor: 'formula' },
        { field: 'name', header: 'Name' },
      ],
      datasource: new AgridDataSource([
        { budget: '=1+1', name: 'Alice' },
      ]),
      control: new AgridControl(),
      showFormulaBar: true,
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.ag-formula-bar-input') as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '=2+3';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    fixture.detectChanges();

    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(provider.datasource.getRow(0)['budget']).toBe('=2+3');
    expect(provider.datasource.getRow(0)['name']).toBe('Alice');
    expect(component.formulaBarDraft()).toBe('Alice');
  });

  it('returns focus to the grid after formula bar Enter commits', () => {
    provider = new AgridProvider({
      columns: [{ field: 'budget', header: 'Budget', editor: 'formula' }],
      datasource: new AgridDataSource([{ budget: '=1+1' }]),
      control: new AgridControl(),
      showFormulaBar: true,
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.ag-wrapper') as HTMLDivElement;
    const input = fixture.nativeElement.querySelector('.ag-formula-bar-input') as HTMLInputElement;
    input.focus();
    input.value = '=2+3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(provider.datasource.getRow(0)['budget']).toBe('=2+3');
    expect(document.activeElement).toBe(wrapper);
  });

  it('updates the active edit draft from formula bar input', () => {
    provider = new AgridProvider({
      columns: [{ field: 'name', header: 'Name' }],
      datasource: new AgridDataSource([{ name: 'Alice' }]),
      control: new AgridControl(),
      showFormulaBar: true,
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    component.onStartEdit(0, 0);
    fixture.detectChanges();

    component.onFormulaBarInput({ target: { value: 'Alicia' } } as unknown as Event);

    expect(component.currentDraft()).toBe('Alicia');
  });

  it('keeps added rows visible under filters until the control reapplies filters', () => {
    provider.control.setTextFilter('name', 'Alice');
    provider.control.addSort('name', 'asc');
    fixture.detectChanges();

    provider.datasource.addRow({ name: '', department: 'Sales' });
    fixture.detectChanges();

    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name']))
      .toEqual(['Alice', '']);
    expect(provider.control.filterReapplyNeeded()).toBe(true);

    provider.control.reapplyFilters();
    fixture.detectChanges();

    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name']))
      .toEqual(['Alice']);
    expect(provider.control.filterReapplyNeeded()).toBe(false);
  });

  it('hides row deletion from the control-cell menu when readonly', () => {
    provider.readonlyGrid.set(true);
    component.contextMenu.set({ x: 1, y: 2, rowIndex: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ag-context-item--danger')).toBeNull();
  });
});

describe('AgridComponent menu bar', () => {
  let fixture: ComponentFixture<AgridComponent>;
  let component: AgridComponent;

  beforeEach(async () => {
    const provider = new AgridProvider({
      columns: [{ field: 'name', header: 'Name' }],
      datasource: new AgridDataSource([
        { name: 'Alice' },
        { name: 'Bob' },
      ]),
      showControlColumn: true,
      rowSelection: 'single',
      menuBarItems: [
        {
          id: 'refresh',
          label: 'Refresh',
          icon: '↻',
          active: ({ rows }) => rows.length === 2,
        },
        {
          id: 'selected-actions',
          label: 'Selected',
          disabled: ({ selectedRows }) => selectedRows.length === 0,
          items: [
            {
              id: 'export-selected',
              label: 'Export selected',
              active: ({ rows }) => rows.length === 2,
            },
            { id: 'locked-action', label: 'Locked action', disabled: true },
            { id: 'hidden-action', label: 'Hidden action', visible: false },
          ],
        },
        { id: 'empty-only', label: 'Empty only', visible: ({ rows }) => rows.length === 0 },
      ],
    });

    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('resolves item states and emits one action output for buttons and dropdown items', () => {
    const emitted: string[] = [];
    component.menuBarAction.subscribe(id => emitted.push(id));
    const refresh = fixture.nativeElement.querySelector(
      '[data-menu-id="refresh"] .ag-menu-bar-button',
    ) as HTMLButtonElement;
    const selected = fixture.nativeElement.querySelector(
      '[data-menu-id="selected-actions"] .ag-menu-bar-button',
    ) as HTMLButtonElement;

    expect(refresh.textContent).toContain('↻');
    expect(refresh.textContent).toContain('Refresh');
    expect(refresh.classList.contains('ag-menu-bar-button--active')).toBe(true);
    expect(selected.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-menu-id="empty-only"]')).toBeNull();

    refresh.click();
    component.onControlPointerDown(primaryPointerEvent(), 0);
    fixture.detectChanges();
    expect(selected.disabled).toBe(false);

    const trigger = fixture.nativeElement.querySelector(
      '[data-menu-id="selected-actions"] .ag-menu-bar-trigger',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const dropdownItems = [
      ...fixture.nativeElement.querySelectorAll('.ag-menu-bar-dropdown-item'),
    ] as HTMLButtonElement[];
    expect(dropdownItems.map(item => item.textContent?.trim())).toEqual([
      '✓Export selected',
      'Locked action',
    ]);
    expect(dropdownItems[0].classList.contains('ag-menu-bar-dropdown-item--active')).toBe(true);
    expect(dropdownItems[1].disabled).toBe(true);

    dropdownItems[0].click();

    expect(emitted).toEqual(['refresh', 'export-selected']);
    expect(component.openMenuBarItemId()).toBeNull();
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

    provider.control.clearChangedCells(0, ['name']);
    fixture.detectChanges();
    expect(component.isCellChanged(0, 'name')).toBe(false);
    expect(component.isCellChanged(0, 'department')).toBe(true);

    provider.control.clearChangedCells(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.ag-cell--changed')).toHaveLength(0);

    component.selectedCell.set({ rowIndex: 1, colIndex: 0 });
    component.onStartEdit(1, 0);
    component.onDraftChange('Bobby');
    component.onKeyDown(new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
    }));
    provider.control.clearChangedCells();
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

  it('renders transient row indications from the grid control', () => {
    provider.control.indicate(0, '#00ff00', 750);
    fixture.detectChanges();

    const indicatedRow = fixture.nativeElement.querySelector(
      '[data-original-index="0"]',
    ) as HTMLElement;

    expect(indicatedRow.classList.contains('ag-row--indicating')).toBe(true);
    expect(indicatedRow.style.getPropertyValue('--agrid-row-indication-color')).toBe('#00ff00');
    expect(indicatedRow.style.getPropertyValue('--agrid-row-indication-duration')).toBe('750ms');
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

  it('emits rowChanged after a values dropdown edit leaves the row', async () => {
    const valueProvider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'status', header: 'Status', values: ['Open', 'Done'] },
      ],
      datasource: new AgridDataSource([
        { name: 'Task 1', status: 'Open' },
        { name: 'Task 2', status: 'Open' },
      ]),
      control: new AgridControl({ allowRowReorder: false }),
    });
    const valueFixture = TestBed.createComponent(AgridComponent);
    valueFixture.componentRef.setInput('provider', valueProvider);
    valueFixture.detectChanges();
    const valueComponent = valueFixture.componentInstance;
    const emitted: RowUpdateEvent[] = [];
    valueComponent.rowChanged.subscribe(event => emitted.push(event));

    valueComponent.onStartEdit(0, 1);
    valueComponent.onDraftChange('Done');
    valueComponent.onActivate(1, 0);
    valueFixture.detectChanges();
    await Promise.resolve();

    expect(valueComponent.selectedCell()).toEqual({ rowIndex: 1, colIndex: 0 });
    expect(emitted).toEqual([{
      row: { name: 'Task 1', status: 'Done' },
      originalIndex: 0,
    }]);
    valueFixture.destroy();
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

  it('emits rowChanged after inline edit idle when the active row cannot be left', async () => {
    vi.useFakeTimers();
    try {
      provider.control.setQuickFilter('Alice');
      fixture.detectChanges();
      const emitted: RowUpdateEvent[] = [];
      component.rowChanged.subscribe(event => emitted.push(event));

      component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
      component.onStartEdit(0, 0);
      component.onDraftChange('Alicia');
      component.onKeyDown(new KeyboardEvent('keydown', {
        key: 'Enter',
        cancelable: true,
      }));
      fixture.detectChanges();
      await Promise.resolve();

      expect(component.selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(1999);
      expect(emitted).toHaveLength(0);

      vi.advanceTimersByTime(1);
      expect(emitted).toEqual([{
        row: { name: 'Alicia', department: 'Engineering' },
        originalIndex: 0,
      }]);
    } finally {
      vi.useRealTimers();
    }
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
    component.filterMenu.set({ field: 'name', mode: 'column', x: 7, y: 8 });
    component.openMenuBarItemId.set('actions');
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
    expect(component.openMenuBarItemId()).toBeNull();
  });

  it('closes an open header menu from the document-level Escape hotkey', () => {
    component.filterMenu.set({ field: 'name', mode: 'column', x: 7, y: 8 });
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(component.filterMenu()).toBeNull();
  });

  it('closes open menus from a document-level pointerdown outside the grid', () => {
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
    component.filterMenu.set({ field: 'name', mode: 'column', x: 7, y: 8 });
    component.openMenuBarItemId.set('actions');
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    outside.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
    }));

    expect(component.contextMenu()).toBeNull();
    expect(component.cellContextMenuState()).toBeNull();
    expect(component.groupActionsMenu()).toBeNull();
    expect(component.filterMenu()).toBeNull();
    expect(component.openMenuBarItemId()).toBeNull();
    outside.remove();
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

  it('keeps the selected cell attached to the same row object when rows are prepended', async () => {
    const alice = { name: 'Alice', department: 'Engineering' };
    const bob = { name: 'Bob', department: 'Sales' };
    provider.datasource.setData([alice, bob]);
    fixture.detectChanges();
    component.selectedCell.set({ rowIndex: 1, colIndex: 0 });

    provider.datasource.setData([
      { name: 'Zoe', department: 'Support' },
      alice,
      bob,
    ]);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));

    expect(component.selectedCell()).toEqual({ rowIndex: 2, colIndex: 0 });
    expect(component.getCurrentCell()?.row).toBe(bob);
  });

  it('uses getRowId to keep selection visible when a prepended row moves it to another page', async () => {
    const pagedProvider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
      ],
      datasource: new AgridDataSource([
        { id: 1, name: 'Alice', department: 'Engineering' },
        { id: 2, name: 'Bob', department: 'Sales' },
      ]),
      control: new AgridControl({ pageSize: 1, currentPage: 2 }),
      getRowId: (row: any) => row.id,
    });
    const pagedFixture = TestBed.createComponent(AgridComponent);
    pagedFixture.componentRef.setInput('provider', pagedProvider);
    pagedFixture.detectChanges();
    const pagedComponent = pagedFixture.componentInstance;
    pagedComponent.selectedCell.set({ rowIndex: 1, colIndex: 0 });

    pagedProvider.datasource.setData([
      { id: 0, name: 'Zoe', department: 'Support' },
      { id: 1, name: 'Alice', department: 'Engineering' },
      { id: 2, name: 'Bob', department: 'Sales' },
    ]);
    pagedFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    pagedFixture.detectChanges();

    expect(pagedComponent.selectedCell()).toEqual({ rowIndex: 2, colIndex: 0 });
    expect(pagedProvider.control.currentPage()).toBe(3);
    expect(visibleDataRows(pagedComponent.filteredItems()).map(item => item.row['name']))
      .toEqual(['Bob']);
    pagedFixture.destroy();
  });

  it('updates pagination totals when server totalRows is incremented after a row is added', async () => {
    const pagedProvider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
      ]),
      control: new AgridControl({ pageSize: 2, totalRows: 2 }),
    });
    const pagedFixture = TestBed.createComponent(AgridComponent);
    pagedFixture.componentRef.setInput('provider', pagedProvider);
    pagedFixture.detectChanges();
    const pageInfo = () =>
      (pagedFixture.nativeElement.querySelector('.ag-page-info') as HTMLElement).textContent?.trim();
    const pageCount = () =>
      (pagedFixture.nativeElement.querySelector('.ag-page-count') as HTMLElement).textContent?.trim();

    expect(pageInfo()).toBe('1 / 1');
    expect(pageCount()).toBe('2 rows');

    pagedProvider.datasource.addRow({ name: 'Carol', department: 'Support' });
    pagedProvider.control.setTotalRows(pagedProvider.control.totalRows() + 1);
    pagedFixture.detectChanges();

    expect(pageInfo()).toBe('1 / 2');
    expect(pageCount()).toBe('3 rows');
    pagedFixture.destroy();
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
    const markEvents: unknown[] = [];
    markingComponent.rowMark.subscribe(event => markEvents.push(event));
    const marker = markingFixture.nativeElement.querySelector(
      '.ag-row-marker',
    ) as HTMLInputElement;
    const rowHeader = marker.closest('.ag-control-cell') as HTMLElement;

    expect(markingComponent.showControlColumn()).toBe(true);
    expect(marker).not.toBeNull();
    marker.click();
    markingFixture.detectChanges();

    expect([...markingComponent.markedRowIndices()]).toEqual([0]);
    expect(markEvents).toEqual([{
      row: { name: 'Alice', department: 'Engineering' },
      originalIndex: 0,
      marked: true,
    }]);
    expect(markingFixture.nativeElement.querySelector(
      '.ag-scroll-pane [data-original-index="0"]',
    )?.classList.contains('ag-row--marked')).toBe(true);

    rowHeader.click();
    markingFixture.detectChanges();
    expect(markingComponent.markedRowIndices().size).toBe(0);
    expect(markEvents.at(-1)).toEqual({
      row: { name: 'Alice', department: 'Engineering' },
      originalIndex: 0,
      marked: false,
    });

    markingComponent.toggleRowMarked(0);
    markingComponent.clearMarkedRows();
    expect(markingComponent.markedRowIndices().size).toBe(0);
    markingFixture.destroy();
  });

  it('renders optional control-column row numbers in filtered and sorted order', async () => {
    const numberedProvider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
      ],
      datasource: new AgridDataSource([
        { name: 'Alice', department: 'Engineering' },
        { name: 'Bob', department: 'Sales' },
        { name: 'Carol', department: 'Engineering' },
        { name: 'David', department: 'Engineering' },
      ]),
      showRowNumbers: true,
    });
    numberedProvider.control.setQuickFilter('Engineering');
    numberedProvider.control.setSort('name', 'desc');
    const numberedFixture = TestBed.createComponent(AgridComponent);
    numberedFixture.componentRef.setInput('provider', numberedProvider);
    numberedFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    numberedFixture.detectChanges();
    const numberedComponent = numberedFixture.componentInstance;
    const numbers = [...numberedFixture.nativeElement.querySelectorAll('.ag-row-number')]
      .map(el => (el as HTMLElement).textContent?.trim());
    const firstControlCell = numberedFixture.nativeElement.querySelector(
      '.ag-control-cell',
    ) as HTMLElement;

    expect(numberedComponent.showControlColumn()).toBe(true);
    expect(numberedComponent.controlColumnWidth()).toBe(36);
    expect(numberedComponent.rowNumbers().get(3)).toBe(1);
    expect(numberedComponent.rowNumbers().get(2)).toBe(2);
    expect(numberedComponent.rowNumbers().get(0)).toBe(3);
    expect(numbers).toEqual(['1', '2', '3']);
    expect(firstControlCell.classList.contains('ag-control-cell--numbered')).toBe(true);
    expect(firstControlCell.classList.contains('ag-control-cell--reorder')).toBe(true);
    numberedFixture.destroy();
  });

  it('keeps row numbers readable when row marking also uses the control column', async () => {
    const numberedMarkingProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource([{ name: 'Alice', department: 'Engineering' }]),
      showRowNumbers: true,
      enableRowMarking: true,
    });
    const numberedMarkingFixture = TestBed.createComponent(AgridComponent);
    numberedMarkingFixture.componentRef.setInput('provider', numberedMarkingProvider);
    numberedMarkingFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    numberedMarkingFixture.detectChanges();
    const numberedMarkingComponent = numberedMarkingFixture.componentInstance;

    expect(numberedMarkingComponent.controlColumnWidth()).toBe(56);
    expect(numberedMarkingFixture.nativeElement.querySelector('.ag-row-number')?.textContent?.trim())
      .toBe('1');
    expect(numberedMarkingFixture.nativeElement.querySelector('.ag-row-marker')).not.toBeNull();
    numberedMarkingFixture.destroy();
  });

  it('sizes the control column from the largest visible row number', async () => {
    const rows = Array.from({ length: 10000 }, (_, index) => ({
      name: `Row ${index + 1}`,
      department: 'Performance',
    }));
    const numberedProvider = new AgridProvider({
      columns: provider.columns(),
      datasource: new AgridDataSource(rows),
      showRowNumbers: true,
    });
    numberedProvider.control.setPageSize(10);
    const numberedFixture = TestBed.createComponent(AgridComponent);
    numberedFixture.componentRef.setInput('provider', numberedProvider);
    numberedFixture.detectChanges();
    const numberedComponent = numberedFixture.componentInstance;

    expect(numberedComponent.controlColumnWidth()).toBe(36);

    numberedProvider.control.setPage(1000);
    numberedFixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    numberedFixture.detectChanges();

    expect(numberedComponent.controlColumnWidth()).toBe(60);
    expect(numberedFixture.nativeElement.querySelector('.ag-row-number')?.textContent?.trim())
      .toBe('9991');
    numberedFixture.destroy();
  });

  it('keeps marked rows attached across grid insertions and deletions', () => {
    provider.enableRowMarking = true;
    component.toggleRowMarked(0);

    component.insertRowAt(0);
    expect([...component.markedRowIndices()]).toEqual([1]);

    component.deleteRow(0);
    expect([...component.markedRowIndices()]).toEqual([0]);
  });

  it('marks a complete column from its header and emits its typed state', () => {
    provider.enableColumnMarking = true;
    const events: unknown[] = [];
    component.columnMark.subscribe(event => events.push(event));

    component.onColHeaderClick(new MouseEvent('click'), 'name');
    fixture.detectChanges();

    expect([...component.markedColumnFields()]).toEqual(['name']);
    expect(events).toEqual([{
      column: provider.columns()[0],
      field: 'name',
      marked: true,
    }]);

    component.setColumnMarked('name', false);
    expect(component.markedColumnFields().size).toBe(0);
    expect((events.at(-1) as { marked: boolean }).marked).toBe(false);
  });

  it('emits custom column-header actions and closes the menu', () => {
    const actions: unknown[] = [];
    component.columnHeaderAction.subscribe(event => actions.push(event));
    component.filterMenu.set({ field: 'name', mode: 'column', x: 10, y: 10 });

    component.onColumnHeaderAction('name', 'archive');

    expect(actions).toEqual([{ column: provider.columns()[0], key: 'archive' }]);
    expect(component.filterMenu()).toBeNull();
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

    component.filterMenu.set({ field: 'name', mode: 'column', x: 0, y: 0 });
    component.onMenuSort('name', 'asc');
    expect(component.filterMenu()).toBeNull();

    component.filterMenu.set({ field: 'name', mode: 'column', x: 0, y: 0 });
    component.onMenuSort('name', 'asc');

    expect(emitted).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: null },
    ]);
    expect(component.filterMenu()).toBeNull();
    expect(visibleDataRows(component.filteredItems()).map(item => item.row['name']))
      .toEqual(['Bob', 'Alice']);
  });

  it('publishes a complete server query for signal-backed data stores', () => {
    const emitted: unknown[] = [];
    component.serverQueryChange.subscribe(event => emitted.push(event));
    provider.control.setPageSize(25);
    provider.control.setPage(2);

    component.onTextFilterChange({ target: { value: 'ali' } } as unknown as Event, 'name');
    component.filterMenu.set({ field: 'department', mode: 'column', x: 0, y: 0 });
    component.onMenuToggleValue('department', 'Sales');
    component.onMenuSort('name', 'asc');
    component.onQuickFilterInput({ target: { value: 'priority' } } as unknown as Event);
    fixture.detectChanges();

    expect(provider.serverQuery()).toEqual({
      filters: {
        name: { text: 'ali', selectedValues: null, sort: 'asc' },
        department: { text: '', selectedValues: ['Engineering'], sort: null },
      },
      sort: [{ field: 'name', direction: 'asc' }],
      quickFilter: 'priority',
      page: 2,
      pageSize: 25,
      startRow: 25,
      endRow: 49,
    });
    expect(emitted.at(-1)).toEqual(provider.serverQuery());
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
    component.filterMenu.set({ field: 'name', mode: 'column', x: 0, y: 0 });
    fixture.detectChanges();

    const menuText = fixture.nativeElement.querySelector('.ag-filter-menu')?.textContent ?? '';
    expect(menuText).not.toContain(component.localeText().sortAscending);
    expect(menuText).not.toContain(component.localeText().sortDescending);

    component.onMenuSort('name', 'asc');
    expect(provider.control.sortOrder()).toEqual([]);
  });

  it('hides the Excel-style value picker', () => {
    component.filterMenu.set({ field: 'name', mode: 'column', x: 0, y: 0 });
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

  it('applies a defaultExpanded callback on first render', () => {
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
        defaultExpanded: (r: any) => r.id === 1,
      },
    });
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();

    expect(visibleNames()).toEqual(['Root', 'Child A', 'Child B', 'Root B']);
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

  it('emits click and double-click events for generated branch nodes', async () => {
    const provider = new AgridProvider({
      columns: [{ field: 'oz', header: 'OZ' }],
      datasource: new AgridDataSource([
        { oz: '01.01.0001', uuid: 'node-01' },
        { oz: '01.01.0002', uuid: 'node-02' },
        { oz: '01.02.0001', uuid: 'node-03' },
      ]),
      treeConfig: {
        getPath: row => row.oz.split('.'),
        treeField: 'oz',
        nodeUuid: row => row.uuid,
      },
    });
    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const clicks: TreeNodeClickEvent[] = [];
    const doubleClicks: TreeNodeClickEvent[] = [];
    component.treeNodeClick.subscribe(event => clicks.push(event));
    component.treeNodeDoubleClicked.subscribe(event => doubleClicks.push(event));

    component.expandAllNodes();
    fixture.detectChanges();
    const branch = component.displayItems().find(component.isPathTreeNodeItem)!;

    component.onTreeNodeClick(branch);
    component.onTreeNodeDoubleClick(branch);

    expect(clicks).toEqual([{
      uuid: 'node-01',
      pathNodeId: '__agrid_path__["01"]',
      pathLabel: '01',
      level: 0,
      expanded: true,
      node: {
        uuid: 'node-01',
        pathNodeId: '__agrid_path__["01"]',
        pathLabel: '01',
        level: 0,
        expandable: true,
        expanded: true,
      },
    }]);
    expect(doubleClicks).toEqual(clicks);
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
        {
          field: 'kind',
          header: 'Kind',
          validate: value => value === 'invalid' ? 'Kind is invalid' : null,
        },
        { field: 'status', header: 'Status' },
      ],
      datasource: new AgridDataSource([
        { name: 'Row 0', kind: 'data', status: 'open' },
        { name: 'Row 1', kind: 'data', status: 'open' },
        { name: 'Summary', kind: 'summary', status: 'closed' },
      ]),
      control: new AgridControl({ allowRowReorder: false }),
      getRowClass: ({ row }) => (row['kind'] === 'summary' ? 'is-summary' : ''),
      pinRow: row => (row['kind'] === 'summary' ? 'bottom' : undefined),
      masterDetail: true,
      detailRenderer: ({ row }) => `<b>${row['name']}</b>`,
      detailColumnField: 'kind',
      detailActions: [
        { id: 'greeting', label: 'Greeting', text: 'Hello ' },
        { id: 'row-name', label: 'Row name', text: ({ row }) => String(row.name) },
      ],
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

  it('edits the configured detail column as multiline text', () => {
    const edits: GridEditEvent[] = [];
    component.cellEdit.subscribe(event => edits.push(event));
    component.toggleDetail(0);
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.ag-detail-column-value') as HTMLElement;
    expect(value.textContent?.trim()).toBe('data');
    value.click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector(
      '.ag-detail-column-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('data');
    textarea.value = 'first line\nsecond line';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(component.provider().datasource.getRow(0)['kind']).toBe('first line\nsecond line');
    expect(component.provider().datasource.getRow(1)['kind']).toBe('data');
    expect(edits.at(-1)).toMatchObject({
      position: { rowIndex: 0, colIndex: 1 },
      field: 'kind',
      oldValue: 'data',
      newValue: 'first line\nsecond line',
    });
    expect(component.provider().control.canUndo()).toBe(true);
  });

  it('inserts configured detail action text into the detail textarea', async () => {
    component.toggleDetail(0);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.ag-detail-action-btn',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    let textarea = fixture.nativeElement.querySelector(
      '.ag-detail-column-textarea',
    ) as HTMLTextAreaElement;
    expect(component.detailEditingRow()).toBe(0);
    expect(textarea.value).toBe('dataHello ');
    expect(document.activeElement).toBe(textarea);

    textarea.setSelectionRange(4, textarea.value.length);
    buttons[1].click();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));
    fixture.detectChanges();

    textarea = fixture.nativeElement.querySelector('.ag-detail-column-textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('dataRow 0');
    expect(textarea.selectionStart).toBe('dataRow 0'.length);
  });

  it('routes forward and backward keyboard movement through the detail textarea', () => {
    component.toggleDetail(0);
    fixture.detectChanges();

    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    const withinRow = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    component.onKeyDown(withinRow);
    fixture.detectChanges();

    expect(withinRow.defaultPrevented).toBe(true);
    expect(component.detailEditingRow()).toBeNull();
    expect(component.selectedCell()).toEqual({ rowIndex: 0, colIndex: 2 });

    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    component.onKeyDown(forward);
    fixture.detectChanges();

    expect(forward.defaultPrevented).toBe(true);
    expect(component.detailEditingRow()).toBe(0);
    expect(component.selectedCell()).toBeNull();

    component.cancelDetailFieldEdit();
    expect(component.selectedCell()).toEqual({ rowIndex: 0, colIndex: 2 });

    component.selectedCell.set({ rowIndex: 1, colIndex: 0 });
    const backward = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    component.onKeyDown(backward);
    fixture.detectChanges();

    expect(backward.defaultPrevented).toBe(true);
    expect(component.detailEditingRow()).toBe(0);
    expect(component.selectedCell()).toBeNull();
  });

  it('clears the active cell outline while editing a detail textarea from click', () => {
    component.toggleDetail(0);
    component.selectedCell.set({ rowIndex: 0, colIndex: 1 });
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.ag-detail-column-value') as HTMLElement;
    value.click();
    fixture.detectChanges();

    expect(component.detailEditingRow()).toBe(0);
    expect(component.selectedCell()).toBeNull();

    component.cancelDetailFieldEdit();

    expect(component.selectedCell()).toBeNull();
  });

  it('keeps invalid detail textarea edits active and does not let grid Tab navigation steal them', async () => {
    const failures: unknown[] = [];
    component.validationFailed.subscribe(event => failures.push(event));
    component.toggleDetail(0);
    fixture.detectChanges();

    const value = fixture.nativeElement.querySelector('.ag-detail-column-value') as HTMLElement;
    value.click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector(
      '.ag-detail-column-textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'invalid';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve));

    expect(component.detailEditingRow()).toBe(0);
    expect(component.detailValidationError()).toBe('Kind is invalid');
    expect(component.provider().datasource.getRow(0)['kind']).toBe('data');
    expect(failures).toHaveLength(1);
    expect(document.activeElement).toBe(textarea);

    textarea.value = 'corrected';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.detailDraft()).toBe('corrected');

    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    textarea.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    }));
    fixture.detectChanges();

    expect(component.detailEditingRow()).toBe(0);
    expect(component.detailDraft()).toBe('corrected');
    expect(component.selectedCell()).toEqual({ rowIndex: 0, colIndex: 0 });
  });

  it('resolves whole-row CSS classes from getRowClass', () => {
    expect(component.getRowClass({ kind: 'summary' }, 2)).toBe('is-summary');
    expect(component.getRowClass({ kind: 'data' }, 0)).toBe('');
  });
});

describe('AgridComponent horizontal cell spanning', () => {
  let fixture: ComponentFixture<AgridComponent>;

  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  beforeEach(async () => {
    const provider = new AgridProvider({
      columns: [
        {
          field: 'label',
          header: 'Label',
          textAlign: 'center',
          colSpan: ({ row }) => row['summary'] ? 2 : 1,
          cellFormat: ({ row }) => row['summary'] ? { textAlign: 'right' } : undefined,
        },
        { field: 'quantity', header: 'Quantity' },
        { field: 'total', header: 'Total' },
      ],
      datasource: new AgridDataSource([
        { label: 'Summary', quantity: 2, total: 40, summary: true },
        { label: 'Normal', quantity: 1, total: 20, summary: false },
      ]),
      control: new AgridControl({ allowRowReorder: false }),
      pinRow: () => 'top',
    });

    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('renders the anchor across columns and hides only the covered row cell', () => {
    const host = fixture.nativeElement as HTMLElement;
    const summaryCells = Array.from(
      host.querySelectorAll<HTMLElement>('[data-cell-row="0"]'),
    );
    const normalCells = Array.from(
      host.querySelectorAll<HTMLElement>('[data-cell-row="1"]'),
    );

    expect(summaryCells).toHaveLength(3);
    expect(summaryCells[0].style.gridColumn).toBe('span 2');
    expect(summaryCells[0].getAttribute('aria-colspan')).toBe('2');
    expect(summaryCells[0].style.textAlign).toBe('right');
    expect(summaryCells[1].style.display).toBe('none');
    expect(summaryCells[2].style.display).toBe('');
    expect(normalCells.every(cell => cell.style.display === '')).toBe(true);
    expect(normalCells[0].style.textAlign).toBe('center');
  });

});

describe('AgridComponent first data render lifecycle', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollTo = () => undefined;
  });

  it('waits for non-empty datasource data and emits only after its first render', async () => {
    const datasource = new AgridDataSource<{ name: string }>([]);
    const provider = new AgridProvider({
      columns: [{ field: 'name', header: 'Name' }],
      datasource,
    });
    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AgridComponent<{ name: string }>);
    fixture.componentRef.setInput('provider', provider);
    const events: unknown[] = [];
    fixture.componentInstance.firstDataRendered.subscribe(event => events.push(event));

    fixture.detectChanges();
    await Promise.resolve();
    expect(events).toEqual([]);

    datasource.setData([{ name: 'Alice' }, { name: 'Bob' }]);
    fixture.detectChanges();
    await Promise.resolve();
    expect(events).toEqual([{
      rows: datasource.rows(),
      rowCount: 2,
      provider,
      datasource,
    }]);

    datasource.setData([{ name: 'Carol' }]);
    fixture.detectChanges();
    await Promise.resolve();
    expect(events).toHaveLength(1);
    fixture.destroy();
  });
});

describe('AgridComponent selection status bar', () => {
  it('updates numeric statistics when the selected range data changes', async () => {
    const datasource = new AgridDataSource([
      { name: 'A', amount: 10, score: 2 },
      { name: 'B', amount: 20, score: 4 },
    ]);
    const provider = new AgridProvider({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'amount', header: 'Amount', type: 'number' },
        { field: 'score', header: 'Score', type: 'number' },
      ],
      datasource,
    });
    await TestBed.configureTestingModule({ imports: [AgridComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AgridComponent);
    fixture.componentRef.setInput('provider', provider);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.selectedCell.set({ rowIndex: 1, colIndex: 2 });
    component.selectedRange.set({
      anchor: { rowIndex: 0, colIndex: 1 },
      focus: { rowIndex: 1, colIndex: 2 },
    });
    fixture.detectChanges();

    expect(component.selectionSummary()).toEqual({
      count: 4, sum: 36, average: 9, min: 2, max: 20,
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.ag-status-bar')?.textContent)
      .toContain('Sum: 36');

    datasource.patchRow(0, { amount: 30 });
    fixture.detectChanges();
    expect(component.selectionSummary()).toEqual({
      count: 4, sum: 56, average: 14, min: 2, max: 30,
    });

    component.selectedRange.set(null);
    component.selectedCell.set({ rowIndex: 0, colIndex: 0 });
    fixture.detectChanges();
    expect(component.selectionSummary()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ag-status-bar')).toBeNull();
    fixture.destroy();
  });
});
