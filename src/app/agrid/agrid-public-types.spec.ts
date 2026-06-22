import { Component } from '@angular/core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { AgridComponent } from './agrid.component';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import { AgridPageItem, AgridPageSelectorComponent } from './agrid-page-selector.component';
import { AgridTreeComponent } from './agrid-tree.component';
import { AgridTreeProvider } from './agrid-tree-provider';
import {
  CellInfoEvent,
  ColDef,
  ColumnHeaderActionEvent,
  ColumnMarkEvent,
  GridEditEvent,
  FirstDataRenderedEvent,
  NewRecord,
  RecordEditEvent,
  RowClickEvent,
  RowMarkEvent,
  RowReorderEvent,
  RowSelectEvent,
  RowUpdateEvent,
} from './agrid.types';

interface PersonRow {
  id: number;
  name: string;
  active: boolean;
}

@Component({
  imports: [AgridComponent, AgridTreeComponent, AgridPageSelectorComponent],
  template: `
    <agrid
      [provider]="provider"
      (recordEdit)="onRecordEdit($event)"
      (rowChanged)="onRowChanged($event)"
      (rowMark)="onRowMark($event)"
      (columnMark)="onColumnMark($event)"
      (columnHeaderAction)="onColumnHeaderAction($event)"
      (firstDataRendered)="onFirstDataRendered($event)"
      (cellInfo)="onCellInfo($event)"
      (menuBarAction)="onMenuBarAction($event)"
    />
    <agrid-tree [provider]="treeProvider" (nodeClick)="onTreeNode($event)" />
    <agrid-page-selector [items]="pages" [selectedPageNumber]="1" (selectPage)="onSelectPage($event)" />
  `,
})
class TypedGridHost {
  readonly pages: AgridPageItem<number>[] = [{ id: "1" , pageNumber : 1, label: 'First' }];
  readonly provider = new AgridProvider<PersonRow>({
    columns: [{ field: 'name', header: 'Name' }],
    datasource: new AgridDataSource<PersonRow>([]),
    menuBarItems: [{
      id: 'activate',
      label: 'Activate',
      visible: ({ rows, selectedRows }) => {
        expectTypeOf(rows).toEqualTypeOf<readonly PersonRow[]>();
        expectTypeOf(selectedRows).toEqualTypeOf<readonly {
          row: PersonRow;
          originalIndex: number;
        }[]>();
        return rows.length > 0;
      },
    }],
  });
  readonly treeProvider = new AgridTreeProvider<PersonRow>({
    datasource: new AgridDataSource<PersonRow>([]),
    treeConfig: {
      getId: row => row.id,
      getParentId: () => null,
      treeField: 'name',
    },
  });

  onRecordEdit(event: RecordEditEvent<PersonRow>): void {
    expectTypeOf(event.data).toEqualTypeOf<PersonRow>();
  }

  onRowChanged(event: RowUpdateEvent<PersonRow>): void {
    expectTypeOf(event.row).toEqualTypeOf<PersonRow>();
  }

  onRowMark(event: RowMarkEvent<PersonRow>): void {
    expectTypeOf(event.row).toEqualTypeOf<PersonRow>();
    expectTypeOf(event.originalIndex).toEqualTypeOf<number>();
    expectTypeOf(event.marked).toEqualTypeOf<boolean>();
  }

  onColumnMark(event: ColumnMarkEvent<PersonRow>): void {
    expectTypeOf(event.column).toEqualTypeOf<ColDef<PersonRow>>();
    expectTypeOf(event.field).toEqualTypeOf<'id' | 'name' | 'active'>();
    expectTypeOf(event.marked).toEqualTypeOf<boolean>();
  }

  onColumnHeaderAction(event: ColumnHeaderActionEvent<PersonRow>): void {
    expectTypeOf(event.column).toEqualTypeOf<ColDef<PersonRow>>();
    expectTypeOf(event.key).toEqualTypeOf<string>();
  }

  onFirstDataRendered(event: FirstDataRenderedEvent<PersonRow>): void {
    expectTypeOf(event.rows).toEqualTypeOf<readonly PersonRow[]>();
    expectTypeOf(event.rowCount).toEqualTypeOf<number>();
    expectTypeOf(event.provider).toEqualTypeOf<AgridProvider<PersonRow>>();
    expectTypeOf(event.datasource).toEqualTypeOf<AgridDataSource<PersonRow>>();
  }

  onCellInfo(event: CellInfoEvent<PersonRow>): void {
    expectTypeOf(event.row).toEqualTypeOf<PersonRow>();
    expectTypeOf(event.field).toEqualTypeOf<'id' | 'name' | 'active'>();
  }

  onMenuBarAction(id: string): void {
    expectTypeOf(id).toEqualTypeOf<string>();
  }

  onTreeNode(event: import('./agrid.types').AgridTreeNodeEvent<PersonRow>): void {
    expectTypeOf(event.row).toEqualTypeOf<PersonRow | undefined>();
  }

  onSelectPage(item: AgridPageItem<number>): void {
    expectTypeOf(item.pageNumber).toEqualTypeOf<number>();
  }
}

describe('typed public contracts', () => {
  it('preserves row types across columns, providers, datasources, and events', () => {
    const columns: ColDef<PersonRow>[] = [
      {
        field: 'id',
        header: 'ID',
        textAlign: 'right',
        headerMenuItems: [{ key: 'archive', label: 'Archive', icon: '⌂' }],
        formatter: value => value.toFixed(0),
        cellFormat: ({ value, row, column, originalIndex }) => {
          expectTypeOf(value).toEqualTypeOf<number>();
          expectTypeOf(row).toEqualTypeOf<PersonRow>();
          expectTypeOf(column.field).toEqualTypeOf<'id'>();
          expectTypeOf(originalIndex).toEqualTypeOf<number>();
          return value === row.id ? { fontWeight: 600, textAlign: 'right' } : undefined;
        },
        colSpan: ({ value, row, column, originalIndex }) => {
          expectTypeOf(value).toEqualTypeOf<number>();
          expectTypeOf(row).toEqualTypeOf<PersonRow>();
          expectTypeOf(column.field).toEqualTypeOf<'id'>();
          expectTypeOf(originalIndex).toEqualTypeOf<number>();
          return row.active ? 2 : 1;
        },
      },
      {
        field: 'name',
        header: 'Name',
        formatter: value => value.toUpperCase(),
        infoIcon: ({ value, row }) => value === row.name,
        inputMask: ({ value, row, column }) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          expectTypeOf(row).toEqualTypeOf<PersonRow>();
          expectTypeOf(column.field).toEqualTypeOf<'name'>();
          return row.active ? /[a-z]{0,3}(?: [a-z]{0,5})?/i : null;
        },
      },
      {
        field: 'active',
        header: 'Active',
        values: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ],
      },
    ];
    const datasource = new AgridDataSource<PersonRow>([
      { id: 1, name: 'Alice', active: true },
    ]);
    const provider = new AgridProvider<PersonRow>({ columns, datasource });
    const inferredProvider = new AgridProvider({ columns, datasource });

    expectTypeOf(provider.datasource.getRow(0)).toEqualTypeOf<PersonRow>();
    expectTypeOf(inferredProvider.datasource.getRow(0)).toEqualTypeOf<PersonRow>();
    expectTypeOf(provider.columns()).toEqualTypeOf<ColDef<PersonRow>[]>();
    expectTypeOf<NewRecord<PersonRow>['data']>().toEqualTypeOf<PersonRow>();
    expectTypeOf<RecordEditEvent<PersonRow>['data']>().toEqualTypeOf<PersonRow>();
    expectTypeOf<RowClickEvent<PersonRow>['row']>().toEqualTypeOf<PersonRow>();
    expectTypeOf<RowReorderEvent<PersonRow>['row']>().toEqualTypeOf<PersonRow>();
    expectTypeOf<RowSelectEvent<PersonRow>['rows'][number]['row']>()
      .toEqualTypeOf<PersonRow>();
    expectTypeOf<CellInfoEvent<PersonRow>['row']>().toEqualTypeOf<PersonRow>();

    const edit = null as GridEditEvent<PersonRow> | null;
    if (edit?.field === 'name') {
      expectTypeOf(edit.oldValue).toEqualTypeOf<string>();
      expectTypeOf(edit.newValue).toEqualTypeOf<string>();
    }

    expect(provider.datasource.getRow(0).name).toBe('Alice');
    expect(new TypedGridHost().provider.datasource.length).toBe(0);
  });

  it('rejects fields and values that do not belong to the row type', () => {
    const invalidField: ColDef<PersonRow> = {
      // @ts-expect-error `email` is not a key of PersonRow.
      field: 'email',
      header: 'Email',
    };
    // @ts-expect-error `active` stores booleans.
    const invalidValue: ColDef<PersonRow> = {
      field: 'active',
      header: 'Active',
      values: [
        { value: 'yes', label: 'Yes' },
      ],
    };

    expect(invalidField.header).toBe('Email');
    expect(invalidValue.header).toBe('Active');
  });
});
