/** Built-in locale identifiers supplied by the grid. */
export type AgridLocaleKey = 'en' | 'de';

/** Complete set of user-facing strings and label factories used by the grid. */
export interface AgridLocaleText {
  actions: string;
  addRow: string;
  aggregate: string;
  aggregateAvg: string;
  aggregateCount: string;
  aggregateCustom: string;
  aggregateMax: string;
  aggregateMin: string;
  aggregateSum: string;
  autosizeColumn: string;
  blank: string;
  clearAllFilters: string;
  clearFilter: string;
  clearSort: string;
  close: string;
  columnMenu: string;
  columns: string;
  collapse: string;
  detail: string;
  toggleDetail: string;
  hiddenColumn: string;
  filterCondition: string;
  filterConditionMenu: string;
  filterValue: string;
  filterNoCondition: string;
  filterOpEquals: string;
  filterOpNotEquals: string;
  filterOpGreater: string;
  filterOpGreaterEqual: string;
  filterOpLess: string;
  filterOpLessEqual: string;
  filterOpBetween: string;
  filterOpBefore: string;
  filterOpAfter: string;
  filterOpOn: string;
  filterOpLike: string;
  filterOpStartsWith: string;
  filterOpEndsWith: string;
  filterOpIncludes: string;
  filterOpNotIncludes: string;
  copyCellValue: string;
  copyRow: string;
  confirmDeleteRow: string;
  confirmNo: string;
  confirmYes: string;
  deleteRow: string;
  filterPlaceholder: string;
  findPlaceholder: string;
  firstPage: string;
  grid: string;
  groupBy: (header: string) => string;
  hideColumn: string;
  insertRowAbove: string;
  insertRowBelow: string;
  lastPage: string;
  loading: string;
  markRow: string;
  moreInformation: string;
  next: string;
  noRows: string;
  pagination: string;
  pivot: string;
  pivotDescription: string;
  pivotRows: string;
  pivotColumns: string;
  pivotValues: string;
  pinColumn: string;
  pinColumnRight: string;
  unpinColumnRight: string;
  pinRowTop: string;
  pinRowBottom: string;
  unpinRow: string;
  previous: string;
  resizeColumn: string;
  expand: string;
  rows: (count: number) => string;
  quickFilterPlaceholder: string;
  searchValuesPlaceholder: string;
  selectAll: string;
  sortOnlyByThis: string;
  sortAscending: string;
  sortDescending: string;
  ungroup: string;
  unpinColumn: string;
  save: string;
  saveConfig:string;
  export:string;
  exportCsv:string;
  exportXlsx:string;
}

/** Partial locale text supplied to {@link AgridProvider.addLocalization}. */
export type AgridLocaleTextOverrides = Partial<AgridLocaleText>;

/** Built-in English and German grid translations. */
export const AGRID_LOCALE_TEXT: Record<AgridLocaleKey, AgridLocaleText> = {
  en: {
    actions: 'Actions',
    addRow: 'Add row',
    aggregate: 'Aggregate',
    aggregateAvg: 'Average',
    aggregateCount: 'Count',
    aggregateCustom: 'Custom function',
    aggregateMax: 'Maximum',
    aggregateMin: 'Minimum',
    aggregateSum: 'Sum',
    autosizeColumn: 'Autosize column',
    blank: '(blank)',
    clearAllFilters: 'Clear all filters',
    clearFilter: 'Clear filter',
    clearSort: 'Clear sort',
    close: 'Close',
    columnMenu: 'Column menu',
    columns: 'Columns',
    collapse: 'Collapse',
    detail: 'Detail',
    toggleDetail: 'Toggle detail panel',
    hiddenColumn: '(hidden)',
    filterCondition: 'Condition',
    filterConditionMenu: 'Filter condition',
    filterValue: 'Value',
    filterNoCondition: 'No condition',
    filterOpEquals: 'Equals',
    filterOpNotEquals: 'Not equal',
    filterOpGreater: 'Greater than',
    filterOpGreaterEqual: 'Greater or equal',
    filterOpLess: 'Less than',
    filterOpLessEqual: 'Less or equal',
    filterOpBetween: 'Between',
    filterOpBefore: 'Before',
    filterOpAfter: 'After',
    filterOpOn: 'On',
    filterOpLike: 'Like (% and _ wildcards)',
    filterOpStartsWith: 'Starts with',
    filterOpEndsWith: 'Ends with',
    filterOpIncludes: 'Includes',
    filterOpNotIncludes: 'Does not include',
    copyCellValue: 'Copy cell',
    copyRow: 'Copy row',
    confirmDeleteRow: 'Sure to delete?',
    confirmNo: 'No',
    confirmYes: 'Yes',
    deleteRow: 'Delete row',
    filterPlaceholder: 'Filter...',
    findPlaceholder: 'Find',
    firstPage: 'First page',
    grid: 'Data grid',
    groupBy: header => `Group by ${header}`,
    hideColumn: 'Hide column',
    insertRowAbove: 'Insert row above',
    insertRowBelow: 'Insert row below',
    lastPage: 'Last page',
    loading: 'Loading...',
    markRow: 'Mark row for copying',
    moreInformation: 'More information',
    next: 'Next',
    noRows: 'No rows to display',
    pagination: 'Pagination',
    pivot: 'Pivot',
    pivotDescription: 'Configure the fields used to build the pivot result.',
    pivotRows: 'Rows',
    pivotColumns: 'Columns',
    pivotValues: 'Values',
    pinColumn: 'Pin left',
    pinColumnRight: 'Pin right',
    unpinColumnRight: 'Unpin right',
    pinRowTop: 'Pin row to top',
    pinRowBottom: 'Pin row to bottom',
    unpinRow: 'Unpin row',
    previous: 'Previous',
    resizeColumn: 'Resize column',
    expand: 'Expand',
    rows: count => `${count} ${count === 1 ? 'row' : 'rows'}`,
    quickFilterPlaceholder: 'Search all columns...',
    searchValuesPlaceholder: 'Search values...',
    selectAll: '(Select All)',
    sortOnlyByThis: 'Sort only by this column',
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    ungroup: 'Ungroup',
    unpinColumn: 'Unpin column',
    save: 'Save',
    saveConfig:'Save Config',
    export: 'Export',
    exportCsv:'Export to csv',
    exportXlsx:'Export to xlsx'
  },
  de: {
    actions: 'Aktionen',
    addRow: 'Zeile hinzufügen',
    aggregate: 'Aggregat',
    aggregateAvg: 'Durchschnitt',
    aggregateCount: 'Anzahl',
    aggregateCustom: 'Benutzerdefinierte Funktion',
    aggregateMax: 'Maximum',
    aggregateMin: 'Minimum',
    aggregateSum: 'Summe',
    autosizeColumn: 'Spaltenbreite anpassen',
    blank: '(leer)',
    clearAllFilters: 'Alle Filter löschen',
    clearFilter: 'Filter löschen',
    clearSort: 'Sortierung löschen',
    close: 'Schließen',
    columnMenu: 'Spaltenmenü',
    columns: 'Spalten',
    collapse: 'Einklappen',
    detail: 'Details',
    toggleDetail: 'Detailbereich umschalten',
    hiddenColumn: '(ausgeblendet)',
    filterCondition: 'Bedingung',
    filterConditionMenu: 'Filterbedingung',
    filterValue: 'Wert',
    filterNoCondition: 'Keine Bedingung',
    filterOpEquals: 'Gleich',
    filterOpNotEquals: 'Ungleich',
    filterOpGreater: 'Größer als',
    filterOpGreaterEqual: 'Größer oder gleich',
    filterOpLess: 'Kleiner als',
    filterOpLessEqual: 'Kleiner oder gleich',
    filterOpBetween: 'Zwischen',
    filterOpBefore: 'Vor',
    filterOpAfter: 'Nach',
    filterOpOn: 'Am',
    filterOpLike: 'Wie (% und _ Platzhalter)',
    filterOpStartsWith: 'Beginnt mit',
    filterOpEndsWith: 'Endet mit',
    filterOpIncludes: 'Enthält',
    filterOpNotIncludes: 'Enthält nicht',
    copyCellValue: 'Zelle kopieren',
    copyRow: 'Zeile kopieren',
    confirmDeleteRow: 'Wirklich löschen?',
    confirmNo: 'Nein',
    confirmYes: 'Ja',
    deleteRow: 'Zeile löschen',
    filterPlaceholder: 'Filtern...',
    findPlaceholder: 'Suchen',
    firstPage: 'Erste Seite',
    grid: 'Datentabelle',
    groupBy: header => `Nach ${header} gruppieren`,
    hideColumn: 'Spalte ausblenden',
    insertRowAbove: 'Zeile darüber einfügen',
    insertRowBelow: 'Zeile darunter einfügen',
    lastPage: 'Letzte Seite',
    loading: 'Wird geladen...',
    markRow: 'Zeile zum Kopieren markieren',
    moreInformation: 'Weitere Informationen',
    next: 'Weiter',
    noRows: 'Keine Zeilen vorhanden',
    pagination: 'Seitennavigation',
    pivot: 'Pivot',
    pivotDescription: 'Felder für das Pivot-Ergebnis konfigurieren.',
    pivotRows: 'Zeilen',
    pivotColumns: 'Spalten',
    pivotValues: 'Werte',
    pinColumn: 'Links fixieren',
    pinColumnRight: 'Rechts fixieren',
    unpinColumnRight: 'Rechts lösen',
    pinRowTop: 'Zeile oben fixieren',
    pinRowBottom: 'Zeile unten fixieren',
    unpinRow: 'Zeilenfixierung lösen',
    previous: 'Zurück',
    resizeColumn: 'Spaltenbreite ändern',
    expand: 'Ausklappen',
    rows: count => `${count} ${count === 1 ? 'Zeile' : 'Zeilen'}`,
    quickFilterPlaceholder: 'Alle Spalten durchsuchen...',
    searchValuesPlaceholder: 'Werte suchen...',
    selectAll: '(Alle auswählen)',
    sortOnlyByThis: 'Nur nach dieser Spalte sortieren',
    sortAscending: 'Aufsteigend sortieren',
    sortDescending: 'Absteigend sortieren',
    ungroup: 'Gruppierung aufheben',
    unpinColumn: 'Fixierung lösen',
    save: 'Speichern',
    saveConfig: 'Konfig.speichern',
    export:'Export',
    exportCsv:'Export nach csv',
    exportXlsx:'Export nach xlsx'
  },
};

/** Resolves 'auto' to the browser's navigator.language, falling back to 'en-US'. */
export function resolveLocale(locale: string): string {
  if (locale !== 'auto') return locale;
  return (typeof navigator !== 'undefined' ? navigator.language : null) ?? 'en-US';
}

/**
 * Resolves built-in locale text and merges the best matching custom overrides.
 *
 * Matching prefers an exact locale key, then a primary-language match.
 */
export function resolveAgridLocaleText(
  locale: string | undefined,
  localizations: ReadonlyMap<string, AgridLocaleTextOverrides>,
): AgridLocaleText {
  const resolved = resolveLocale(locale ?? 'auto');
  const normalized = resolved.toLowerCase();
  const primaryTag = normalized.split('-')[0];

  const base = normalized.startsWith('de') ? AGRID_LOCALE_TEXT.de : AGRID_LOCALE_TEXT.en;

  // Prefer exact match (case-insensitive), fall back to primary-language match (e.g. 'fr' matches 'fr-FR')
  let overrides: AgridLocaleTextOverrides | undefined;
  for (const [key, value] of localizations) {
    const k = key.toLowerCase();
    if (k === normalized) { overrides = value; break; }
    if (!overrides && k.split('-')[0] === primaryTag) { overrides = value; }
  }

  return { ...base, ...overrides };
}
