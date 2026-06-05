import { AgridControl } from "./agrid-control";
import { AgridDataSource } from "./agrid-datasource";
import { ColDef } from "./agrid.types";

export class AgridProvider<T extends Record<string, unknown> = Record<string, unknown>> {
   datasource : AgridDataSource<T>
   control : AgridControl;
   columns: ColDef[];
   constructor() {
    this.datasource = new AgridDataSource([]);
    this.control = new AgridControl({ allowRowReorder: true });
    this.columns = [];
   }

   getGridData() {
    return this.datasource.rows();
   }
}