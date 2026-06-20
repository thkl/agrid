import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AGRID_LOCALE_TEXT } from '../agrid-localization';
import { AgridHeaderColumn } from '../agrid.types';
import { AgridHeaderGroup } from '../columns/agrid-column-layout.model';
import {
  AgridPaneHeaderColumnEvent,
  AgridPaneHeaderComponent,
  AgridPaneHeaderGroupEvent,
  AgridPaneHeaderResizeEvent,
  AgridPaneVariant,
} from './agrid-pane-header.component';

function headerColumn(overrides: Partial<AgridHeaderColumn> = {}): AgridHeaderColumn {
  const field = overrides.field ?? overrides.col?.field ?? 'name';
  return {
    col: { field, header: 'Name', ...overrides.col },
    field,
    ariaColIndex: 1,
    sort: null,
    sortPriority: 0,
    hasFilter: false,
    dragging: false,
    dropSide: null,
    reorderOffset: 0,
    grouped: false,
    lastPinned: false,
    firstRightPinned: false,
    columnWidth: 120,
    textFilter: '',
    menuFilterType: null,
    hasCondition: false,
    conditionLabel: '=',
    ...overrides,
  };
}

function headerGroup(overrides: Partial<AgridHeaderGroup> = {}): AgridHeaderGroup {
  return {
    key: 'g1',
    id: 'employee',
    label: 'Employee',
    fields: ['firstName', 'lastName'],
    span: 2,
    locked: false,
    dragging: false,
    ...overrides,
  };
}

describe('AgridPaneHeaderComponent', () => {
  let fixture: ComponentFixture<AgridPaneHeaderComponent>;
  let el: HTMLElement;

  function setup(
    variant: AgridPaneVariant,
    columns: AgridHeaderColumn[],
    overrides: Record<string, unknown> = {}
  ) {
    fixture = TestBed.createComponent(AgridPaneHeaderComponent);
    const ref = fixture.componentRef;
    ref.setInput('variant', variant);
    ref.setInput('headerGroups', []);
    ref.setInput('columns', columns);
    ref.setInput('gridTemplateColumns', '120px');
    ref.setInput('paneWidth', 120);
    ref.setInput('totalWidth', 120);
    ref.setInput('hasHeaderGroups', false);
    ref.setInput('hasFilterableColumns', false);
    ref.setInput('headerRowCount', 1);
    ref.setInput('showControlColumn', false);
    ref.setInput('localeText', AGRID_LOCALE_TEXT.en);
    ref.setInput('hasMultiSort', false);
    for (const [key, value] of Object.entries(overrides)) ref.setInput(key, value);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AgridPaneHeaderComponent] }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  it('renders one header cell per column with aria-colindex and aria-sort', () => {
    setup('center', [
      headerColumn({ field: 'name', ariaColIndex: 2, sort: 'asc' }),
      headerColumn({ field: 'email', ariaColIndex: 3, sort: 'desc' }),
    ]);

    const cells = el.querySelectorAll('.ag-header-cell');
    expect(cells.length).toBe(2);
    expect(cells[0].getAttribute('data-col-field')).toBe('name');
    expect(cells[0].getAttribute('aria-sort')).toBe('ascending');
    expect(cells[0].getAttribute('aria-colindex')).toBe('2');
    expect(cells[1].getAttribute('aria-sort')).toBe('descending');
  });

  it('renders the control column only for the left variant when showControlColumn is set', () => {
    setup('left', [headerColumn()], { showControlColumn: true });
    expect(el.querySelector('.ag-control-header')).not.toBeNull();

    setup('center', [headerColumn()], { showControlColumn: true });
    expect(el.querySelector('.ag-control-header')).toBeNull();

    setup('right', [headerColumn()], { showControlColumn: true });
    expect(el.querySelector('.ag-control-header')).toBeNull();
  });

  it('marks header cells pinned for left and right but not center', () => {
    setup('left', [headerColumn()]);
    expect(el.querySelector('.ag-header-cell')!.classList.contains('ag-header-cell--pinned')).toBe(true);

    setup('right', [headerColumn()]);
    expect(el.querySelector('.ag-header-cell')!.classList.contains('ag-header-cell--pinned')).toBe(true);

    setup('center', [headerColumn()]);
    expect(el.querySelector('.ag-header-cell')!.classList.contains('ag-header-cell--pinned')).toBe(false);
  });

  it('applies pinned-last on left and pinned-first on right only', () => {
    setup('left', [headerColumn({ lastPinned: true, firstRightPinned: true })]);
    const left = el.querySelector('.ag-header-cell')!;
    expect(left.classList.contains('ag-header-cell--pinned-last')).toBe(true);
    expect(left.classList.contains('ag-header-cell--pinned-first')).toBe(false);

    setup('right', [headerColumn({ lastPinned: true, firstRightPinned: true })]);
    const right = el.querySelector('.ag-header-cell')!;
    expect(right.classList.contains('ag-header-cell--pinned-first')).toBe(true);
    expect(right.classList.contains('ag-header-cell--pinned-last')).toBe(false);
  });

  it('shows the grouped badge for center/right but never for left', () => {
    setup('left', [headerColumn({ grouped: true })]);
    expect(el.querySelectorAll('.ag-sort-badge').length).toBe(0);

    setup('center', [headerColumn({ grouped: true })]);
    expect(el.querySelector('.ag-sort-badge')!.textContent!.trim()).toBe('⊟');

    setup('right', [headerColumn({ grouped: true })]);
    expect(el.querySelector('.ag-sort-badge')!.textContent).toContain('⊟');
  });

  it('renders the filter row and condition button driven by the view-model', () => {
    setup(
      'center',
      [headerColumn({ col: { field: 'name', header: 'Name', filterable: true }, menuFilterType: 'text', textFilter: 'ab' })],
      { hasFilterableColumns: true }
    );

    const input = el.querySelector('.ag-filter-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('ab');
    expect(el.querySelector('.ag-filter-condition-btn')).not.toBeNull();
  });

  it('omits the condition button when the column has no menu filter type', () => {
    setup(
      'center',
      [headerColumn({ col: { field: 'name', header: 'Name', filterable: true }, menuFilterType: null })],
      { hasFilterableColumns: true }
    );
    expect(el.querySelector('.ag-filter-input')).not.toBeNull();
    expect(el.querySelector('.ag-filter-condition-btn')).toBeNull();
  });

  it('renders grouped-header runs and emits headerGroupPointerDown with the run payload', () => {
    setup('center', [headerColumn()], { hasHeaderGroups: true, headerGroups: [headerGroup()] });

    const groupCell = el.querySelector('.ag-header-group-cell[data-header-group="employee"]') as HTMLElement;
    expect(groupCell).not.toBeNull();
    expect(groupCell.textContent!.trim()).toBe('Employee');

    let payload: AgridPaneHeaderGroupEvent | undefined;
    fixture.componentInstance.headerGroupPointerDown.subscribe(e => (payload = e));
    groupCell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(payload?.fields).toEqual(['firstName', 'lastName']);
    expect(payload?.label).toBe('Employee');
  });

  it('emits colHeaderPointerDown with the field on header pointerdown', () => {
    setup('center', [headerColumn({ field: 'email' })]);
    let payload: AgridPaneHeaderColumnEvent<PointerEvent> | undefined;
    fixture.componentInstance.colHeaderPointerDown.subscribe(e => (payload = e));

    el.querySelector('.ag-header-cell')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(payload?.field).toBe('email');
  });

  it('emits filterMenuOpen when the column menu button is clicked', () => {
    setup('center', [headerColumn({ field: 'email' })]);
    let payload: AgridPaneHeaderColumnEvent<MouseEvent> | undefined;
    fixture.componentInstance.filterMenuOpen.subscribe(e => (payload = e));

    (el.querySelector('.ag-header-menu-btn') as HTMLButtonElement).click();
    expect(payload?.field).toBe('email');
  });

  it('emits textFilterChange when typing in the filter input', () => {
    setup(
      'center',
      [headerColumn({ col: { field: 'name', header: 'Name', filterable: true } })],
      { hasFilterableColumns: true }
    );
    let payload: AgridPaneHeaderColumnEvent | undefined;
    fixture.componentInstance.textFilterChange.subscribe(e => (payload = e));

    const input = el.querySelector('.ag-filter-input') as HTMLInputElement;
    input.value = 'foo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(payload?.field).toBe('name');
  });

  it('emits resize interactions with the underlying ColDef', () => {
    setup('center', [headerColumn({ col: { field: 'name', header: 'Name' } })]);
    const resizes: AgridPaneHeaderResizeEvent[] = [];
    fixture.componentInstance.resizeStart.subscribe(e => resizes.push(e));
    fixture.componentInstance.autosizeColumn.subscribe(e => resizes.push(e));
    fixture.componentInstance.resizeKeyDown.subscribe(e => resizes.push(e));

    const handle = el.querySelector('.ag-resize-handle') as HTMLElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    expect(resizes.length).toBe(3);
    expect(resizes.every(e => e.col.field === 'name')).toBe(true);
  });
});
