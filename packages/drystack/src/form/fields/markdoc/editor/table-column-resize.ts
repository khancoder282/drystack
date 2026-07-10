import {
  Node as ProsemirrorNode,
  ResolvedPos,
} from 'prosemirror-model';
import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { TableMap, cellAround, pointsAtCell } from 'prosemirror-tables';

import { css, tokenSchema } from '@keystar/ui/style';

// how close (in px) the pointer must be to a column boundary to activate
// its resize handle
const HANDLE_HITBOX = 6;
// columns can't be dragged smaller than this, in px — matches roughly to a
// couple of characters of padding so a column can't be squeezed to nothing
const MIN_COLUMN_WIDTH_PX = 40;

type CellRef = { pos: number };

type Dragging = {
  startX: number;
  leftPx: number;
  rightPx: number;
  tableWidthPx: number;
  minPx: number;
  leftCells: CellRef[];
  rightCells: CellRef[];
  // updated on every pointermove — `decorations()` reads this to render the
  // live preview (see `buildDragDecorations`)
  currentClientX: number;
};

type PluginState = {
  // doc position of the cell immediately to the left of the active/dragged
  // boundary, or -1 when no boundary is active
  activeHandle: number;
  dragging: Dragging | null;
};

export const tableColumnResizingKey = new PluginKey<PluginState>(
  'tableColumnResizing'
);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function domCellAround(target: EventTarget | null): HTMLElement | null {
  let node = target as HTMLElement | null;
  while (node && node.nodeName !== 'TD' && node.nodeName !== 'TH') {
    if (node.classList?.contains('ProseMirror')) return null;
    node = node.parentElement;
  }
  return node;
}

// every plain (colspan === 1) cell that occupies column `col`, one per row
// it appears in — cells belonging to a column-spanning merge are skipped,
// since there's no single cell whose width represents just that column
function plainCellsInColumn(
  table: ProsemirrorNode,
  map: TableMap,
  tableStart: number,
  col: number
): CellRef[] {
  const cells: CellRef[] = [];
  for (let row = 0; row < map.height; row++) {
    const mapIndex = row * map.width + col;
    if (row > 0 && map.map[mapIndex] === map.map[mapIndex - map.width]) {
      continue; // rowspan continuation from the row above
    }
    const relPos = map.map[mapIndex];
    const node = table.nodeAt(relPos);
    if (!node || node.attrs.colspan !== 1 || map.colCount(relPos) !== col) {
      continue;
    }
    cells.push({ pos: tableStart + relPos });
  }
  return cells;
}

// resolves the doc position of the cell to the left of the boundary nearest
// `event`'s x-position on the given side of the hovered cell — or -1 if
// that boundary isn't resizable (table edge, or either side is a merged
// cell that doesn't cleanly represent a single column)
function edgeCellPos(
  view: EditorView,
  event: PointerEvent,
  side: 'left' | 'right'
): number {
  const offset = side === 'right' ? -HANDLE_HITBOX : HANDLE_HITBOX;
  const found = view.posAtCoords({
    left: event.clientX + offset,
    top: event.clientY,
  });
  if (!found) return -1;
  const $cell = cellAround(view.state.doc.resolve(found.pos));
  if (!$cell) return -1;
  const table = $cell.node(-1);
  const map = TableMap.get(table);
  const tableStart = $cell.start(-1);
  const relPos = $cell.pos - tableStart;
  const cellNode = table.nodeAt(relPos);
  if (!cellNode || cellNode.attrs.colspan !== 1) return -1;
  const col = map.colCount(relPos);
  const row = Math.floor(map.map.indexOf(relPos) / map.width);
  const neighborCol = side === 'left' ? col - 1 : col + 1;
  if (neighborCol < 0 || neighborCol >= map.width) return -1;
  const neighborRelPos = map.map[row * map.width + neighborCol];
  const neighborNode = table.nodeAt(neighborRelPos);
  if (!neighborNode || neighborNode.attrs.colspan !== 1) return -1;
  return tableStart + (side === 'left' ? neighborRelPos : relPos);
}

function draggedWidths(dragging: Dragging, clientX: number) {
  const dx = clientX - dragging.startX;
  const totalPx = dragging.leftPx + dragging.rightPx;
  const newLeftPx = Math.min(
    Math.max(dragging.leftPx + dx, dragging.minPx),
    totalPx - dragging.minPx
  );
  const newRightPx = totalPx - newLeftPx;
  return {
    leftPct: round1((newLeftPx / dragging.tableWidthPx) * 100),
    rightPct: round1((newRightPx / dragging.tableWidthPx) * 100),
  };
}

// Live preview during a drag. `EditorView.nodeDOM` explicitly documents that
// direct DOM mutation ("do not mutate the editor DOM directly... that will
// be immediately overriden by the editor as it redraws the node") gets
// reverted by ProseMirror's own DOM-mutation observer — which is exactly why
// a raw-DOM version of this appeared to do nothing until the drag ended.
// Decorations are the supported way to render a transient visual override:
// `style` attrs from a node decoration are appended after (and so, per CSS
// cascade, win over) the cell's own `toDOM`-rendered `style`.
function buildDragDecorations(state: EditorState, dragging: Dragging): Decoration[] {
  const { leftPct, rightPct } = draggedWidths(dragging, dragging.currentClientX);
  const decorations: Decoration[] = [];
  const addRange = (cells: CellRef[], pct: number) => {
    for (const { pos } of cells) {
      const node = state.doc.nodeAt(pos);
      if (!node) continue;
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { style: `width:${pct}%` })
      );
    }
  };
  addRange(dragging.leftCells, leftPct);
  addRange(dragging.rightCells, rightPct);
  return decorations;
}

// Applies a plugin-only meta transaction directly via `view.updateState`
// instead of `view.dispatch`. This app's `dispatchTransaction` (see
// editor-view.tsx) forwards every dispatched transaction to the form's
// `onChange`, which is a React state update — fine for the occasional
// hover-boundary change, but the drag preview fires on every animation
// frame, and funneling that through React (60/sec, marking the form dirty
// the whole time for a change that isn't even part of the document) was
// enough to trip React's nested-update guard ("Maximum update depth
// exceeded"). `updateState` re-syncs the view's own DOM/decorations
// exactly like `dispatch` would, without involving React at all — the only
// transaction that should reach `dispatch` is the final commit on drop.
function updateViewMeta(view: EditorView, meta: unknown) {
  const tr = view.state.tr.setMeta(tableColumnResizingKey, meta);
  view.updateState(view.state.apply(tr));
}

function commitResize(
  view: EditorView,
  leftCells: CellRef[],
  rightCells: CellRef[],
  leftPct: number,
  rightPct: number
) {
  let tr = view.state.tr;
  for (const { pos } of leftCells) {
    tr = tr.setNodeAttribute(pos, 'widthPercent', leftPct);
  }
  for (const { pos } of rightCells) {
    tr = tr.setNodeAttribute(pos, 'widthPercent', rightPct);
  }
  tr.setMeta(tableColumnResizingKey, { setHandle: -1 });
  view.dispatch(tr);
}

function startDrag(view: EditorView, activeHandle: number, event: PointerEvent) {
  const $cell = view.state.doc.resolve(activeHandle);
  const table = $cell.node(-1);
  const map = TableMap.get(table);
  const tableStart = $cell.start(-1);
  const relPos = $cell.pos - tableStart;
  const leftCol = map.colCount(relPos);
  const rightCol = leftCol + 1;
  const leftCells = plainCellsInColumn(table, map, tableStart, leftCol);
  const rightCells = plainCellsInColumn(table, map, tableStart, rightCol);
  if (!leftCells.length || !rightCells.length) return;

  const leftDom = view.nodeDOM(activeHandle) as HTMLElement | null;
  const tableDom = leftDom?.closest('table') ?? null;
  const row = Math.floor(map.map.indexOf(relPos) / map.width);
  const rightRelPos = map.map[row * map.width + rightCol];
  const rightDom = view.nodeDOM(tableStart + rightRelPos) as HTMLElement | null;
  if (!leftDom || !rightDom || !tableDom) return;

  const leftPx = leftDom.getBoundingClientRect().width;
  const rightPx = rightDom.getBoundingClientRect().width;
  const tableWidthPx = tableDom.getBoundingClientRect().width;
  const totalPx = leftPx + rightPx;
  const minPx = Math.min(MIN_COLUMN_WIDTH_PX, totalPx / 2);

  const dragging: Dragging = {
    startX: event.clientX,
    leftPx,
    rightPx,
    tableWidthPx,
    minPx,
    leftCells,
    rightCells,
    currentClientX: event.clientX,
  };
  updateViewMeta(view, { setDragging: dragging });

  const win = view.dom.ownerDocument.defaultView ?? window;
  let lastClientX = event.clientX;
  let rafId: number | null = null;

  const move = (moveEvent: PointerEvent) => {
    lastClientX = moveEvent.clientX;
    if (rafId != null) return;
    rafId = win.requestAnimationFrame(() => {
      rafId = null;
      updateViewMeta(view, { updateDragX: lastClientX });
    });
  };
  const finish = () => {
    win.removeEventListener('pointermove', move);
    win.removeEventListener('pointerup', finish);
    if (rafId != null) {
      win.cancelAnimationFrame(rafId);
      rafId = null;
    }
    const pluginState = tableColumnResizingKey.getState(view.state);
    if (pluginState?.dragging) {
      const { leftPct, rightPct } = draggedWidths(pluginState.dragging, lastClientX);
      commitResize(
        view,
        pluginState.dragging.leftCells,
        pluginState.dragging.rightCells,
        leftPct,
        rightPct
      );
    }
  };
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', finish);
}

function buildHandleDecorations(
  state: EditorState,
  pluginState: PluginState
): DecorationSet {
  if (pluginState.activeHandle < 0) return DecorationSet.empty;
  let $cell: ResolvedPos;
  try {
    $cell = state.doc.resolve(pluginState.activeHandle);
  } catch {
    return DecorationSet.empty;
  }
  const table = $cell.node(-1);
  if (!table) return DecorationSet.empty;
  const map = TableMap.get(table);
  const tableStart = $cell.start(-1);
  const relPos = $cell.pos - tableStart;
  const leftCol = map.colCount(relPos);
  const cells = plainCellsInColumn(table, map, tableStart, leftCol);
  const decorations = cells.map(({ pos }) =>
    Decoration.widget(
      pos + 1,
      () => {
        const el = document.createElement('div');
        el.className = handleClass;
        return el;
      },
      { key: `table-col-resize-${pos}`, side: 1 }
    )
  );
  return DecorationSet.create(state.doc, decorations);
}

// Percentage-based column resizing for tables: dragging a handle trades
// width between the two columns on either side of it (their combined width
// stays constant) instead of growing/shrinking the whole table, and commits
// the result as a `widthPercent` attr on every plain cell in each column —
// rendered as inline `style="width:…%"` (see `cellSpanDOMAttrs` in
// schema.tsx).
export function tableColumnResizing(): Plugin<PluginState> {
  return new Plugin<PluginState>({
    key: tableColumnResizingKey,
    state: {
      init: () => ({ activeHandle: -1, dragging: null }),
      apply(tr, prev) {
        const meta = tr.getMeta(tableColumnResizingKey);
        if (meta && 'setHandle' in meta) {
          return { activeHandle: meta.setHandle, dragging: null };
        }
        if (meta && 'setDragging' in meta) {
          return { ...prev, dragging: meta.setDragging };
        }
        if (meta && 'updateDragX' in meta && prev.dragging) {
          return {
            ...prev,
            dragging: { ...prev.dragging, currentClientX: meta.updateDragX },
          };
        }
        if (prev.activeHandle > -1 && tr.docChanged) {
          const mapped = tr.mapping.map(prev.activeHandle, -1);
          return {
            ...prev,
            activeHandle: pointsAtCell(tr.doc.resolve(mapped)) ? mapped : -1,
          };
        }
        return prev;
      },
    },
    props: {
      attributes(state): Record<string, string> {
        const pluginState = tableColumnResizingKey.getState(state);
        return pluginState && pluginState.activeHandle > -1
          ? { class: resizeCursorClass }
          : {};
      },
      decorations(state) {
        const pluginState = tableColumnResizingKey.getState(state);
        if (!pluginState) return;
        const handles = buildHandleDecorations(state, pluginState);
        if (!pluginState.dragging) return handles;
        return handles.add(state.doc, buildDragDecorations(state, pluginState.dragging));
      },
      handleDOMEvents: {
        pointermove(view, event) {
          if (!view.editable) return false;
          const pluginState = tableColumnResizingKey.getState(view.state);
          if (!pluginState || pluginState.dragging) return false;
          const target = domCellAround(event.target);
          let handle = -1;
          if (target) {
            const rect = target.getBoundingClientRect();
            if (event.clientX - rect.left <= HANDLE_HITBOX) {
              handle = edgeCellPos(view, event, 'left');
            } else if (rect.right - event.clientX <= HANDLE_HITBOX) {
              handle = edgeCellPos(view, event, 'right');
            }
          }
          if (handle !== pluginState.activeHandle) {
            updateViewMeta(view, { setHandle: handle });
          }
          return false;
        },
        pointerleave(view) {
          const pluginState = tableColumnResizingKey.getState(view.state);
          if (pluginState && pluginState.activeHandle > -1 && !pluginState.dragging) {
            updateViewMeta(view, { setHandle: -1 });
          }
          return false;
        },
        pointerdown(view, event) {
          if (!view.editable) return false;
          const pluginState = tableColumnResizingKey.getState(view.state);
          if (!pluginState || pluginState.activeHandle === -1 || pluginState.dragging) {
            return false;
          }
          startDrag(view, pluginState.activeHandle, event);
          event.preventDefault();
          return true;
        },
      },
    },
  });
}

const resizeCursorClass = css({
  '& td, & th': { cursor: 'col-resize' },
});

const handleClass = css({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetInlineEnd: -2,
  width: 4,
  cursor: 'col-resize',
  backgroundColor: tokenSchema.color.alias.borderSelected,
  zIndex: 1,
  pointerEvents: 'none',
});
