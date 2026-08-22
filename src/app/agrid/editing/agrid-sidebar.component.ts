import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from '../agrid-localization';
import { getCellValue, getDateInputValue, getDisplayForField, looksLikeDate, matchesInputMask } from '../agrid.utils';
import { AgridPivotConfig, ColDef, HeaderGroup } from '../agrid.types';

/** Tabs available from the grid's vertical sidebar strip. @internal */
export type AgridSidebarTab = 'columns' | 'detail' | 'pivot';

/** Field edit emitted by the sidebar detail form. @internal */
export interface AgridSidebarEdit {
  /** Data field being edited. */
  field: string;
  /** Column definition controlling value coercion and editability. */
  col: ColDef;
  /** Raw string value produced by the form control. */
  value: string;
}

/** Display and edit model for one sidebar detail field. @internal */
export interface AgridSidebarDetailField {
  /** Human-readable field label. */
  label: string;
  /** Formatted read-only display value. */
  value: string;
  /** Original value stored in the row. */
  rawValue: unknown;
  /** String value supplied to the field editor. */
  inputValue: string;
  /** Whether the corresponding grid column is hidden. */
  hidden: boolean;
  /** Whether the field can be edited in the current grid state. */
  editable: boolean;
  /** Column definition associated with the field. */
  col: ColDef;
}

/** Visibility change requested from a grouped sidebar column entry. @internal */
export interface AgridSidebarGroupToggle {
  /** Fields belonging to the selected header group. */
  fields: string[];
  /** Requested visibility for every field in the group. */
  visible: boolean;
}

/** Grouped or standalone entry rendered in the sidebar column tree. @internal */
export type AgridSidebarColumnEntry =
  | { kind: 'column'; col: ColDef }
  | { kind: 'group'; id: string; label: string; columns: ColDef[] };

/** Sidebar view for column visibility and selected-row details. @internal */
@Component({
  selector: 'agrid-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agrid-sidebar.component.html',
  styleUrl: './agrid-sidebar.component.css',
})
export class AgridSidebarComponent {
  open = input<boolean>(false);
  activeTab = input<AgridSidebarTab>('columns');
  columns = input<ColDef[]>([]);
  /** Original datasource columns available as pivot dimensions and values. */
  pivotColumns = input<ColDef[]>([]);
  /** Active pivot configuration; `null` hides the pivot tab. */
  pivotConfig = input<AgridPivotConfig | null>(null);
  headerGroups = input<HeaderGroup[]>([]);
  row = input<Record<string, unknown> | null>(null);
  rowIndex = input<number | null>(null);
  hiddenColumns = input<ReadonlySet<string>>(new Set());
  locale = input<string | undefined>(undefined);
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);
  readonlyGrid = input<boolean>(false);
  useSidebarEditor = input<boolean>(false);
  isCellEditable = input<(col: ColDef, originalIndex: number) => boolean>(
    col => col.editable !== false,
  );
  /** Per-field validation messages (`field → message`) for rejected detail edits. */
  errors = input<Record<string, string>>({});

  close = output<void>();
  tabChange = output<AgridSidebarTab>();
  toggleColumn = output<string>();
  toggleColumnGroup = output<AgridSidebarGroupToggle>();
  detailEdit = output<AgridSidebarEdit>();
  save = output<AgridSidebarDetailField[]>();
  /** Emits a complete replacement configuration after one pivot control changes. */
  pivotChange = output<AgridPivotConfig>();

  /** Built-in aggregate selected by the sidebar, or `custom` for host functions. */
  readonly pivotAggregate = computed(() => {
    const aggregate = this.pivotConfig()?.aggregate ?? 'sum';
    return typeof aggregate === 'function' ? 'custom' : aggregate;
  });

  /** Localized title for the currently active sidebar tab. */
  activeTabLabel(): string {
    const locale = this.localeText();
    if (this.activeTab() === 'pivot') return locale.pivot;
    return this.activeTab() === 'columns' ? locale.columns : locale.detail;
  }

  /** Replace one pivot dimension/value field while preserving the other settings. */
  onPivotFieldChange(
    field: 'rowField' | 'columnField' | 'valueField',
    event: Event,
  ): void {
    const config = this.pivotConfig();
    if (!config) return;
    this.pivotChange.emit({
      ...config,
      [field]: (event.target as HTMLSelectElement).value,
    });
  }

  /** Replace the pivot aggregate with one of the serializable built-in functions. */
  onPivotAggregateChange(event: Event): void {
    const config = this.pivotConfig();
    if (!config) return;
    const aggregate = (event.target as HTMLSelectElement).value;
    if (aggregate === 'custom') return;
    this.pivotChange.emit({
      ...config,
      aggregate: aggregate as 'sum' | 'avg' | 'min' | 'max' | 'count',
    });
  }

  readonly columnEntries = computed<AgridSidebarColumnEntry[]>(() => {
    const groupLabels = new Map(this.headerGroups().map(group => [group.id, group.label]));
    const entries: AgridSidebarColumnEntry[] = [];
    const groupedEntries = new Map<string, Extract<AgridSidebarColumnEntry, { kind: 'group' }>>();

    for (const col of this.columns()) {
      const groupId = col.group;
      const groupLabel = groupId ? groupLabels.get(groupId) : undefined;
      if (!groupId || !groupLabel) {
        entries.push({ kind: 'column', col });
        continue;
      }

      let entry = groupedEntries.get(groupId);
      if (!entry) {
        entry = { kind: 'group', id: groupId, label: groupLabel, columns: [] };
        groupedEntries.set(groupId, entry);
        entries.push(entry);
      }
      entry.columns.push(col);
    }

    return entries;
  });

  /** Whether every column in a group is currently visible. */
  isGroupVisible(columns: ColDef[]): boolean {
    const hidden = this.hiddenColumns();
    return columns.every(col => !hidden.has(col.field));
  }

  /** Whether a group contains both visible and hidden columns. */
  isGroupPartiallyVisible(columns: ColDef[]): boolean {
    const hidden = this.hiddenColumns();
    const visibleCount = columns.filter(col => !hidden.has(col.field)).length;
    return visibleCount > 0 && visibleCount < columns.length;
  }

  /** Emits a visibility request for all columns belonging to a group. */
  onGroupToggle(columns: ColDef[], event: Event): void {
    this.toggleColumnGroup.emit({
      fields: columns.map(col => col.field),
      visible: (event.target as HTMLInputElement).checked,
    });
  }

  /** Apply the row-aware input mask while preserving the sidebar's change-to-commit behavior. */
  onDetailMaskInput(field: AgridSidebarDetailField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const row = this.row();
    if (row && field.col.inputMask && field.col.type !== 'number' && field.col.type !== 'date') {
      const mask = field.col.inputMask({
        row,
        value: field.rawValue,
        column: field.col,
      });
      if (mask && !matchesInputMask(input.value, mask)) {
        input.value = input.dataset['agridMaskValue'] ?? field.inputValue;
        return;
      }
      input.dataset['agridMaskValue'] = input.value;
    }
  }

  /** Forward the final sidebar value after native change/blur. */
  onDetailChange(field: AgridSidebarDetailField, event: Event): void {
    this.onDetailMaskInput(field, event);
    this.detailEdit.emit({
      field: field.col.field,
      col: field.col,
      value: (event.target as HTMLInputElement).value,
    });
  }

  readonly detailFields = computed<AgridSidebarDetailField[] | null>(() => {
    const row = this.row();
    if (!row) return null;
    const locale = this.locale();
    const readonlyGrid = this.readonlyGrid();
    const hiddenColumns = this.hiddenColumns();
    const rowIndex = this.rowIndex();
    return this.columns().map(col => {
      const rawValue = getCellValue(col, row, rowIndex ?? -1);
      let inputValue = String(rawValue ?? '');
      if (col.type === 'date' || looksLikeDate(rawValue)) {
        inputValue = getDateInputValue(rawValue);
      }
      return {
        label: col.header,
        value: getDisplayForField(col, rawValue, locale, row),
        rawValue,
        inputValue,
        hidden: hiddenColumns.has(col.field),
        editable: !readonlyGrid && rowIndex !== null && this.isCellEditable()(col, rowIndex),
        col,
      };
    });
  });
}
