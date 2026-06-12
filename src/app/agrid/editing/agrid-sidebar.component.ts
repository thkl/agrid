import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from '../agrid-localization';
import { getDateInputValue, getDisplayForField, looksLikeDate } from '../agrid.utils';
import { ColDef, HeaderGroup } from '../agrid.types';

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
  activeTab = input<'columns' | 'detail'>('columns');
  columns = input<ColDef[]>([]);
  headerGroups = input<HeaderGroup[]>([]);
  row = input<Record<string, unknown> | null>(null);
  hiddenColumns = input<ReadonlySet<string>>(new Set());
  locale = input<string | undefined>(undefined);
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);
  readonlyGrid = input<boolean>(false);
  useSidebarEditor = input<boolean>(false);

  close = output<void>();
  tabChange = output<'columns' | 'detail'>();
  toggleColumn = output<string>();
  toggleColumnGroup = output<AgridSidebarGroupToggle>();
  detailEdit = output<AgridSidebarEdit>();
  save = output<AgridSidebarDetailField[]>();

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

  readonly detailFields = computed<AgridSidebarDetailField[] | null>(() => {
    const row = this.row();
    if (!row) return null;
    const locale = this.locale();
    const readonlyGrid = this.readonlyGrid();
    const hiddenColumns = this.hiddenColumns();
    return this.columns().map(col => {
      const rawValue = row[col.field];
      let inputValue = String(rawValue ?? '');
      if (col.type === 'date' || looksLikeDate(rawValue)) {
        inputValue = getDateInputValue(rawValue);
      }
      return {
        label: col.header,
        value: getDisplayForField(col, rawValue, locale),
        rawValue,
        inputValue,
        hidden: hiddenColumns.has(col.field),
        editable: !readonlyGrid && col.editable !== false,
        col,
      };
    });
  });
}
