// Shared AG Grid setup for the dashboard's three grids.
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

// Quartz, tuned to the app's colors (the values mirror the tokens in styles.css).
export const gridTheme = themeQuartz.withParams({
  accentColor: '#0f5f46',
  foregroundColor: '#14211c',
  backgroundColor: '#ffffff',
  borderColor: '#dde3de',
  headerBackgroundColor: '#f7f8f5',
  headerTextColor: '#52625b',
  headerFontWeight: 600,
  rowHoverColor: '#f3f7f4',
  selectedRowBackgroundColor: '#dcf3e6',
  fontFamily: 'inherit',
  fontSize: 14,
  headerFontSize: 13,
  spacing: 7,
  wrapperBorderRadius: 12,
  browserColorScheme: 'light',
});

export const defaultColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  minWidth: 90,
};

export const gridProps = {
  theme: gridTheme,
  defaultColDef,
  rowClass: 'grid-row--link',
  enableCellTextSelection: true,
  tooltipShowDelay: 400,
  animateRows: false, // rows refresh every few seconds; moving them around would be noise
};
