import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { AgridDataSource } from '../agrid-datasource';
import { AgridProvider } from '../agrid-provider';
import {
  AGRID_ROW_HEIGHT_ACTION,
  AGRID_ROW_HEIGHT_COMPACT_ACTION,
  AGRID_SAVE_CONFIG_ACTION,
  AgridMenuBarController,
} from './agrid-menu-bar.controller';
import { AgridMenuBarItem, CellPosition } from '../agrid.types';

describe('AgridMenuBarController', () => {
  function setup(overrides: {
    items?: AgridMenuBarItem[];
    gridId?: string | undefined;
    selectedRowIndices?: ReadonlySet<number>;
    enableExportButtons?: boolean;
    showRowHeightMenu?: boolean;
  } = {}) {
    const dataSource = new AgridDataSource([{ name: 'Alice' }, { name: 'Bob' }]);
    const provider = new AgridProvider();
    const emitAction = vi.fn();
    const closeOtherMenus = vi.fn();
    const persistSettings = vi.fn();
    const exportData = vi.fn();
    const setRowDensity = vi.fn();
    const controller = new AgridMenuBarController({
      dataSource: signal(dataSource),
      provider: signal(provider),
      selectedRowIndices: signal<ReadonlySet<number>>(overrides.selectedRowIndices ?? new Set()),
      selectedCell: signal<CellPosition | null>(null),
      menuBarItems: signal(overrides.items ?? []),
      gridId: signal(overrides.gridId),
      saveConfigLabel: signal('Save'),
      enableExportButtons: signal(overrides.enableExportButtons),
      showRowHeightMenu: signal(overrides.showRowHeightMenu ?? false),
      rowDensity: provider.control.rowDensity,
      exportLabel: signal('Export'),
      exportCsvLabel: signal('CSV'),
      exportXlsxLabel: signal('Excel'),
      rowHeightLabel: signal('Row height'),
      rowHeightCompactLabel: signal('Compact'),
      rowHeightNormalLabel: signal('Normal'),
      rowHeightRelaxedLabel: signal('Relaxed'),
      emitAction,
      closeOtherMenus,
      persistSettings,
      exportData,
      setRowDensity,
    });
    return { controller, dataSource, emitAction, closeOtherMenus, persistSettings, exportData, setRowDensity };
  }

  it('exposes context with sorted, resolved selected rows', () => {
    const { controller } = setup({ selectedRowIndices: new Set([1, 0]) });
    const ctx = controller.context();
    expect(ctx.rows).toHaveLength(2);
    expect(ctx.selectedRows.map(entry => entry.originalIndex)).toEqual([0, 1]);
  });

  it('filters items by their visibility resolver', () => {
    const items: AgridMenuBarItem[] = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', visible: false },
      { id: 'c', label: 'C', visible: ctx => ctx.rows.length > 0 },
    ];
    const { controller } = setup({ items });
    expect(controller.visibleItems().map(item => item.id)).toEqual(['a', 'c']);
  });

  it('prepends the save-config entry only when a gridId is set', () => {
    const items: AgridMenuBarItem[] = [{ id: 'a', label: 'A' }];
    expect(setup({ items }).controller.visibleItems().map(i => i.id)).toEqual(['a']);
    expect(setup({ items, gridId: 'grid-1' }).controller.visibleItems().map(i => i.id))
      .toEqual([AGRID_SAVE_CONFIG_ACTION, 'a']);
  });

  it('adds a built-in row-height menu only when enabled', () => {
    const hidden = setup().controller.visibleItems().map(i => i.id);
    const shown = setup({ showRowHeightMenu: true }).controller.visibleItems();

    expect(hidden).not.toContain(AGRID_ROW_HEIGHT_ACTION);
    expect(shown.map(i => i.id)).toContain(AGRID_ROW_HEIGHT_ACTION);
    expect(shown.find(i => i.id === AGRID_ROW_HEIGHT_ACTION)?.items?.map(i => i.label))
      .toEqual(['Compact', 'Normal', 'Relaxed']);
  });

  it('opens/closes and closes competing menus only when opening', () => {
    const { controller, closeOtherMenus } = setup();
    controller.onOpenItemChange('a');
    expect(controller.openItemId()).toBe('a');
    expect(closeOtherMenus).toHaveBeenCalledTimes(1);

    controller.onOpenItemChange(null);
    expect(controller.openItemId()).toBeNull();
    expect(closeOtherMenus).toHaveBeenCalledTimes(1);

    controller.close();
    expect(controller.openItemId()).toBeNull();
  });

  it('routes the save-config action to persistSettings when a gridId exists', () => {
    const { controller, persistSettings, emitAction } = setup({ gridId: 'grid-1' });
    controller.runAction(AGRID_SAVE_CONFIG_ACTION);
    expect(persistSettings).toHaveBeenCalledTimes(1);
    expect(emitAction).not.toHaveBeenCalled();
  });

  it('emits user actions and does not persist without a gridId', () => {
    const { controller, persistSettings, emitAction } = setup();
    controller.runAction(AGRID_SAVE_CONFIG_ACTION);
    controller.runAction('export');
    expect(persistSettings).not.toHaveBeenCalled();
    expect(emitAction).toHaveBeenNthCalledWith(1, AGRID_SAVE_CONFIG_ACTION);
    expect(emitAction).toHaveBeenNthCalledWith(2, 'export');
  });

  it('routes built-in row-height actions to the controller state callback', () => {
    const { controller, setRowDensity, emitAction } = setup({ showRowHeightMenu: true });

    controller.runAction(AGRID_ROW_HEIGHT_COMPACT_ACTION);

    expect(setRowDensity).toHaveBeenCalledWith('compact');
    expect(emitAction).not.toHaveBeenCalled();
  });
});
