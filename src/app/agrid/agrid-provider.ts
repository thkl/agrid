import { AgridControl } from './agrid-control';
import { AgridDataSource } from './agrid-datasource';
import { AgridLocaleTextOverrides } from './agrid-localization';
import { AGridOptions, ColDef } from './agrid.types';

export interface AgridProviderConfig<T extends Record<string, unknown> = Record<string, unknown>> extends Partial<AGridOptions> {
  datasource?: AgridDataSource<T>;
  control?: AgridControl;
  columns?: ColDef[];
  localization?: AgridLocaleTextOverrides;
}

export class AgridProvider<T extends Record<string, unknown> = Record<string, unknown>> {
  datasource: AgridDataSource<T>;
  control: AgridControl;
  columns: ColDef[];
  options: AGridOptions;
  localization?: AgridLocaleTextOverrides;

  constructor(config: AgridProviderConfig<T> = {}) {
    this.options = { locale: config.locale ?? 'en-US' };
    this.datasource = config.datasource ?? new AgridDataSource<T>([]);
    this.control = config.control ?? new AgridControl({ allowRowReorder: true });
    this.columns = config.columns ?? [];
    this.localization = config.localization;
  }

  getGridData() {
    return this.datasource.rows();
  }
}
