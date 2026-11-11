// Shared AG Grid setup for the dashboard's three grids.
// Only the modules the dashboard uses are registered, which keeps its download small.
import {
  CellStyleModule,
  ClientSideRowModelApiModule,
  ClientSideRowModelModule,
  ColumnApiModule,
  CsvExportModule,
  ExternalFilterModule,
  HighlightChangesModule,
  ModuleRegistry,
  PinnedRowModule,
  QuickFilterModule,
  RowStyleModule,
  TooltipModule,
  ValidationModule,
  themeQuartz,
} from 'ag-grid-community';

ModuleRegistry.registerModules([
  ClientSideRowModelModule, // rows from an array, sorting
  ClientSideRowModelApiModule, // reading the rows on screen (counts, totals row)
  ColumnApiModule, // hiding columns on narrow screens
  QuickFilterModule, // the "Search this table" box
  ExternalFilterModule, // the filter chips
  HighlightChangesModule, // a cell flashes when the live refresh changes it
  PinnedRowModule, // the totals row
  CsvExportModule, // "Export CSV"
  TooltipModule, // full text of truncated cells
  RowStyleModule,
  CellStyleModule,
  ...(import.meta.env.DEV ? [ValidationModule] : []), // helpful warnings while developing only
]);

// The design's table look: paper header, hairline rows, Geist type.
export const gridTheme = themeQuartz.withParams({
  accentColor: '#0E5A43',
  foregroundColor: '#0D1311',
  textColor: '#0D1311',
  backgroundColor: '#FFFFFF',
  borderColor: '#E2E1DA',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  headerBackgroundColor: '#FBFBF8',
  headerTextColor: '#6B7470',
  headerFontSize: 11.5,
  headerFontWeight: 550,
  headerHeight: 40,
  headerColumnBorder: false,
  headerColumnResizeHandleColor: 'transparent', // the design has no column dividers; resizing still works
  columnBorder: false,
  rowBorder: { color: '#E2E1DA' },
  rowHoverColor: '#FAFAF6',
  selectedRowBackgroundColor: '#E3EFE8',
  fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
  fontSize: 14,
  cellHorizontalPadding: 16,
  valueChangeValueHighlightBackgroundColor: 'rgba(198, 243, 107, 0.55)',
  browserColorScheme: 'light',
});

export const defaultColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
  minWidth: 80,
};

// Full text of a (possibly truncated) cell on hover. (`tooltipField` is deprecated since AG Grid 36.2.)
export const tip = (field) => (params) => params.data?.[field] || undefined;

// Money for CSV export and quick search.
export const moneyText = (value) => (value == null ? '' : Number(value).toFixed(2));
