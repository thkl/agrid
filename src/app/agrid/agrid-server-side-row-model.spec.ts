import { AgridControl } from './agrid-control';
import {
  AgridServerSideRequest,
  AgridServerSideResult,
  AgridServerSideRowModel,
} from './agrid-server-side-row-model';

type Row = { id: number; name: string };

describe('AgridServerSideRowModel', () => {
  it('loads intersecting blocks into stable global row indexes', async () => {
    const requests: AgridServerSideRequest[] = [];
    const model = new AgridServerSideRowModel<Row>({
      initialRowCount: 250,
      blockSize: 50,
      datasource: {
        async getRows(request) {
          requests.push(request);
          return {
            rows: Array.from(
              { length: request.endRow - request.startRow },
              (_, offset) => ({ id: request.startRow + offset, name: `Row ${request.startRow + offset}` }),
            ),
            rowCount: 250,
          };
        },
      },
    });

    model.ensureRange(70, 130);
    await settle();

    expect(requests.map(request => [request.startRow, request.endRow])).toEqual([
      [50, 100],
      [100, 150],
    ]);
    expect(model.isPlaceholder(49)).toBe(true);
    expect(model.getRow(70)).toEqual({ id: 70, name: 'Row 70' });
    expect(model.getRow(129)).toEqual({ id: 129, name: 'Row 129' });
  });

  it('forwards filter, sort, and quick-filter state and ignores stale responses', async () => {
    const pending: Array<{
      request: AgridServerSideRequest;
      resolve: (result: AgridServerSideResult<Row>) => void;
    }> = [];
    const model = new AgridServerSideRowModel<Row>({
      initialRowCount: 20,
      blockSize: 20,
      datasource: {
        getRows(request) {
          return new Promise(resolve => pending.push({ request, resolve }));
        },
      },
    });
    const control = new AgridControl();

    model.setQuery(control, []);
    model.ensureRange(0, 20);
    control.setTextFilter('name', 'new');
    control.setSort('name', 'desc');
    control.setQuickFilter('global');
    model.setQuery(control, ['name']);
    model.ensureRange(0, 20);

    expect(pending).toHaveLength(2);
    expect(pending[1].request.filters['name'].text).toBe('new');
    expect(pending[1].request.sort).toEqual([{ field: 'name', direction: 'desc' }]);
    expect(pending[1].request.quickFilter).toBe('global');

    pending[1].resolve({ rows: [{ id: 2, name: 'Current' }], rowCount: 1 });
    await settle();
    pending[0].resolve({ rows: [{ id: 1, name: 'Stale' }], rowCount: 1 });
    await settle();

    expect(model.rows()).toEqual([{ id: 2, name: 'Current' }]);
  });

  it('discovers the final row count from a short block', async () => {
    const model = new AgridServerSideRowModel<Row>({
      blockSize: 10,
      datasource: {
        async getRows(request) {
          return {
            rows: Array.from({ length: 4 }, (_, offset) => ({
              id: request.startRow + offset,
              name: 'row',
            })),
          };
        },
      },
    });

    model.ensureRange(0, 10);
    await settle();

    expect(model.rowCount()).toBe(4);
    expect(model.rows()).toHaveLength(4);
  });

  it('reports whether query state invalidated the block cache', () => {
    const model = new AgridServerSideRowModel<Row>({
      datasource: { async getRows() { return { rows: [] }; } },
    });
    const control = new AgridControl();

    expect(model.setQuery(control, [])).toBe(true);
    expect(model.setQuery(control, [])).toBe(false);
    control.setTextFilter('name', 'alice');
    expect(model.setQuery(control, [])).toBe(true);
  });

  it('tracks failed blocks and retries them on demand', async () => {
    let calls = 0;
    const model = new AgridServerSideRowModel<Row>({
      initialRowCount: 10,
      blockSize: 10,
      datasource: {
        async getRows() {
          calls++;
          if (calls === 1) throw new Error('network');
          return { rows: [{ id: 1, name: 'Recovered' }], rowCount: 1 };
        },
      },
    });

    model.ensureRange(0, 10);
    await settle();

    expect(model.failedBlockIndices()).toEqual([0]);
    expect(model.error()).toBeInstanceOf(Error);

    model.retryFailedBlock();
    await settle();

    expect(model.failedBlockIndices()).toEqual([]);
    expect(model.error()).toBeNull();
    expect(model.getRow(0)).toEqual({ id: 1, name: 'Recovered' });
  });

  it('purges loaded rows back to placeholders', async () => {
    const model = new AgridServerSideRowModel<Row>({
      initialRowCount: 10,
      blockSize: 10,
      datasource: {
        async getRows(request) {
          return {
            rows: Array.from(
              { length: request.endRow - request.startRow },
              (_, offset) => ({ id: offset, name: 'Loaded' }),
            ),
            rowCount: 10,
          };
        },
      },
    });

    model.ensureRange(0, 10);
    await settle();
    expect(model.isPlaceholder(0)).toBe(false);

    model.purgeCache();

    expect(model.isPlaceholder(0)).toBe(true);
    expect(model.rowCount()).toBe(10);
  });
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
