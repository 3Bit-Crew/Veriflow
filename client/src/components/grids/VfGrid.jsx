import { useCallback, useEffect, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useNavigate } from 'react-router-dom';
import { defaultColDef, gridTheme } from './gridSetup.js';

// The grid every dashboard tab uses. On top of AG Grid it adds:
// - the filter chips (AG Grid's external filter) and the search box (quick filter)
// - opening a job by clicking a row or pressing Enter on it
// - hiding less important columns on narrow screens instead of scrolling sideways
// - an optional totals row pinned to the bottom, recalculated for the rows on screen
// - live refreshes that update rows in place (getRowId), so changed cells flash
export default function VfGrid({
  rows,
  columnDefs,
  getRowId,
  getLink,
  search,
  filter,
  rowHeight = 60,
  hideBelow = {},
  totals,
  emptyText,
  onApi,
  onDisplayedCount,
}) {
  const navigate = useNavigate();
  const apiRef = useRef(null);
  const filterRef = useRef(filter);
  const [pinned, setPinned] = useState(undefined);
  const pinnedKey = useRef('');

  filterRef.current = filter;

  // A new chip choice: ask the grid to run the external filter again.
  useEffect(() => {
    apiRef.current?.onFilterChanged();
  }, [filter]);

  const applyWidth = useCallback(
    (api, width) => {
      const byVisibility = { show: [], hide: [] };
      Object.entries(hideBelow).forEach(([colId, min]) => byVisibility[width >= min ? 'show' : 'hide'].push(colId));
      if (byVisibility.show.length) api.setColumnsVisible(byVisibility.show, true);
      if (byVisibility.hide.length) api.setColumnsVisible(byVisibility.hide, false);
    },
    [hideBelow],
  );

  function handleModelUpdated(event) {
    const shown = [];
    event.api.forEachNodeAfterFilterAndSort((node) => shown.push(node.data));
    onDisplayedCount?.(shown.length);
    if (totals) {
      const row = shown.length ? totals(shown) : null;
      const next = row ? [row] : [];
      const key = JSON.stringify(next);
      if (key !== pinnedKey.current) {
        pinnedKey.current = key;
        setPinned(next);
      }
    }
  }

  function open(event) {
    if (event.node.rowPinned || !event.data) return;
    navigate(getLink(event.data));
  }

  return (
    <AgGridReact
      theme={gridTheme}
      rowData={rows ?? []}
      loading={rows === null}
      columnDefs={columnDefs}
      defaultColDef={defaultColDef}
      getRowId={getRowId}
      rowHeight={rowHeight}
      quickFilterText={search}
      isExternalFilterPresent={() => Boolean(filterRef.current)}
      doesExternalFilterPass={(node) => !filterRef.current || filterRef.current(node.data)}
      pinnedBottomRowData={pinned}
      rowClass="row-link"
      tooltipShowDelay={400}
      tooltipInteraction
      enableCellTextSelection
      animateRows
      onGridReady={(event) => {
        apiRef.current = event.api;
        onApi?.(event.api);
      }}
      onGridSizeChanged={(event) => applyWidth(event.api, event.clientWidth)}
      onModelUpdated={handleModelUpdated}
      onRowClicked={open}
      onCellKeyDown={(event) => event.event?.key === 'Enter' && open(event)}
      overlayNoRowsTemplate={`<span class="muted">${emptyText}</span>`}
    />
  );
}
