/** Built-in locale identifiers supplied by the grid. */
export type AgridLocaleKey = 'en' | 'de';

/** Complete set of user-facing strings and label factories used by the grid. */
export interface AgridLocaleText {
  actions: string;
  addRow: string;
  aggregate: string;
  aggregateAvg: string;
  aggregateCount: string;
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
  detail: string;
  hiddenColumn: string;
  copyCellValue: string;
  copyRow: string;
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
  next: string;
  noRows: string;
  pagination: string;
  pinColumn: string;
  pinColumnRight: string;
  unpinColumnRight: string;
  previous: string;
  resizeColumn: string;
  rows: (count: number) => string;
  searchValuesPlaceholder: string;
  selectAll: string;
  sortOnlyByThis: string;
  sortAscending: string;
  sortDescending: string;
  ungroup: string;
  unpinColumn: string;
  save: string;
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
    detail: 'Detail',
    hiddenColumn: '(hidden)',
    copyCellValue: 'Copy cell',
    copyRow: 'Copy row',
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
    next: 'Next',
    noRows: 'No rows to display',
    pagination: 'Pagination',
    pinColumn: 'Pin left',
    pinColumnRight: 'Pin right',
    unpinColumnRight: 'Unpin right',
    previous: 'Previous',
    resizeColumn: 'Resize column',
    rows: count => `${count} ${count === 1 ? 'row' : 'rows'}`,
    searchValuesPlaceholder: 'Search values...',
    selectAll: '(Select All)',
    sortOnlyByThis: 'Sort only by this column',
    sortAscending: 'Sort ascending',
    sortDescending: 'Sort descending',
    ungroup: 'Ungroup',
    unpinColumn: 'Unpin column',
    save: 'Save',
  },
  de: {
    actions: 'Aktionen',
    addRow: 'Zeile hinzufügen',
    aggregate: 'Aggregat',
    aggregateAvg: 'Durchschnitt',
    aggregateCount: 'Anzahl',
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
    detail: 'Details',
    hiddenColumn: '(ausgeblendet)',
    copyCellValue: 'Zelle kopieren',
    copyRow: 'Zeile kopieren',
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
    next: 'Weiter',
    noRows: 'Keine Zeilen vorhanden',
    pagination: 'Seitennavigation',
    pinColumn: 'Links fixieren',
    pinColumnRight: 'Rechts fixieren',
    unpinColumnRight: 'Rechts lösen',
    previous: 'Zurück',
    resizeColumn: 'Spaltenbreite ändern',
    rows: count => `${count} ${count === 1 ? 'Zeile' : 'Zeilen'}`,
    searchValuesPlaceholder: 'Werte suchen...',
    selectAll: '(Alle auswählen)',
    sortOnlyByThis: 'Nur nach dieser Spalte sortieren',
    sortAscending: 'Aufsteigend sortieren',
    sortDescending: 'Absteigend sortieren',
    ungroup: 'Gruppierung aufheben',
    unpinColumn: 'Fixierung lösen',
    save: 'Speichern',
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
