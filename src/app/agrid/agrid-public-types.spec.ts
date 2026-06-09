import { Component } from '@angular/core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { AgridComponent } from './agrid.component';
import { AgridDataSource } from './agrid-datasource';
import { AgridProvider } from './agrid-provider';
import {
  ColDef,
  GridEditEvent,
  NewRecord,
  RecordEditEvent,
  RowClickEvent,
  RowReorderEvent,
  RowSelectEvent,
} from './agrid.types';

interface PersonRow {
  id: number;
  name: string;
  active: boolean;
}

@Component({
  imports: [AgridComponent],
  template: '<agrid [provider]="provider" (recordEdit)="onRecordEdit($event)" />',
})
class TypedGridHost {
  readonly provider = new AgridProvider<PersonRow>({
    columns: [{ field: 'name', header: 'Name' }],
    datasource: new AgridDataSource<PersonRow>([]),
  });

  onRecordEdit(event: RecordEditEvent<PersonRow>): void {
    expectTypeOf(event.data).toEqualTypeOf<PersonRow>();
  }
}

describe('typed public contracts', () => {
  it('preserves row types across columns, providers, datasources, and events', () => {
    const columns: ColDef<PersonRow>[] = [
      {
        field: 'id',
        header: 'ID',
        formatter: value => value.toFixed(0),
      },
      {
        field: 'name',
        header: 'Name',
        formatter: value => value.toUpperCase(),
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
