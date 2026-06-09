import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AgridLocaleText, AGRID_LOCALE_TEXT } from './agrid-localization';
import { getDisplayForField, looksLikeDate } from './agrid.utils';
import { ColDef } from './agrid.types';

export interface AgridSidebarEdit {
  field: string;
  col: ColDef;
  value: string;
}

export interface AgridSidebarDetailField {
  label: string;
  value: string;
  rawValue: unknown;
  inputValue: string;
  hidden: boolean;
  editable: boolean;
  col: ColDef;
}

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
  row = input<Record<string, unknown> | null>(null);
  hiddenColumns = input<ReadonlySet<string>>(new Set());
  locale = input<string | undefined>(undefined);
  localeText = input<AgridLocaleText>(AGRID_LOCALE_TEXT.en);
  readonlyGrid = input<boolean>(false);
  useSidebarEditor = input<boolean>(false);

  close = output<void>();
  tabChange = output<'columns' | 'detail'>();
  toggleColumn = output<string>();
  detailEdit = output<AgridSidebarEdit>();
  save = output<AgridSidebarDetailField[]>();

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
        const date = rawValue instanceof Date ? rawValue : new Date(rawValue as string);
        if (!Number.isNaN(date.getTime())) inputValue = date.toISOString().slice(0, 10);
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
