import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { css, tokenSchema } from '@keystar/ui/style';

// Notion-style drag handle. On hover, a small grip button floats in the left
// gutter of the block under the pointer; dragging it starts a native HTML5
// drag whose payload we hand to `view.dragging`, so prosemirror-view's own
// `drop` handler performs the move and the existing `dropCursor()` plugin shows
// where it will land. Modelled on `dropcursor.ts` (which does the same
// offsetParent-relative positioning for the drop indicator).

const HANDLE_SIZE = 18; // px — the square hit area of the grip button
const HANDLE_GAP = 4; // px — space between the handle and the block's left edge
const HIDE_DELAY = 200; // ms — grace period so moving onto the handle keeps it

// same glyph as `@keystar/ui`'s gripVerticalIcon, but rendered as filled dots
// (the icon is stroke-based; a raw filled SVG avoids pulling React into this
// otherwise-imperative plugin view)
const GRIP_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>' +
  '<circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>' +
  '</svg>';

const handleClass = css({
  alignItems: 'center',
  backgroundColor: 'transparent',
  border: 0,
  borderRadius: tokenSchema.size.radius.small,
  color: tokenSchema.color.foreground.neutralTertiary,
  cursor: 'grab',
  display: 'none',
  height: `${HANDLE_SIZE}px`,
  justifyContent: 'center',
  padding: 0,
  position: 'absolute',
  userSelect: 'none',
  width: `${HANDLE_SIZE}px`,
  zIndex: 50,

  '&:hover': {
    backgroundColor: tokenSchema.color.alias.backgroundHovered,
    color: tokenSchema.color.foreground.neutral,
  },
  '&:active': {
    cursor: 'grabbing',
  },
  '& svg': {
    pointerEvents: 'none',
  },
});

const LIST_TYPES = new Set(['ordered_list', 'unordered_list', 'list_item']);

type HandleTarget = { pos: number; isListItem: boolean };

// Shared between the plugin view (which sets it on dragstart) and the plugin's
// `handleDrop` prop (which reads it to enforce reorder-only lists). One object
// per editor — `blockHandle()` runs once when the state is created.
type DragState = { isListItem: boolean };

export const blockHandleKey = new PluginKey('blockHandle');

class BlockHandleView {
  private view: EditorView;
  private dragState: DragState;
  private handle: HTMLDivElement;
  private target: HandleTarget | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private rafId: number | null = null;
  private hideTimeout: number | null = null;

  constructor(view: EditorView, dragState: DragState) {
    this.view = view;
    this.dragState = dragState;

    const handle = document.createElement('div');
    handle.className = handleClass;
    handle.innerHTML = GRIP_SVG;
    handle.draggable = true;
    handle.setAttribute('aria-hidden', 'true');
    handle.setAttribute('contenteditable', 'false');
    handle.addEventListener('dragstart', this.onDragStart);
    handle.addEventListener('dragend', this.onDragEnd);
    handle.addEventListener('mouseenter', this.cancelScheduledHide);
    handle.addEventListener('mouseleave', this.scheduleHide);
    this.handle = handle;

    view.dom.addEventListener('mousemove', this.onMouseMove);
    view.dom.addEventListener('mouseleave', this.scheduleHide);
    // capture so scrolls in any ancestor container reach us
    window.addEventListener('scroll', this.onScroll, true);
  }

  update(view: EditorView, prevState: EditorView['state']) {
    // positions of everything we track shift on a doc change; drop the handle
    // and let the next mousemove recompute. Selection-only changes (e.g. the
    // NodeSelection we set on dragstart) leave the doc untouched, so the drag
    // isn't interrupted.
    if (prevState.doc !== view.state.doc) {
      this.hide();
    }
  }

  destroy() {
    this.view.dom.removeEventListener('mousemove', this.onMouseMove);
    this.view.dom.removeEventListener('mouseleave', this.scheduleHide);
    window.removeEventListener('scroll', this.onScroll, true);
    this.cancelScheduledHide();
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.handle.remove();
  }

  private onMouseMove = (event: MouseEvent) => {
    this.cancelScheduledHide();
    this.lastPointer = { x: event.clientX, y: event.clientY };
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.lastPointer) {
        this.updateFromPointer(this.lastPointer.x, this.lastPointer.y);
      }
    });
  };

  private onScroll = () => {
    if (this.target) this.positionAt(this.target.pos);
  };

  private updateFromPointer(clientX: number, clientY: number) {
    const target = this.resolveTarget(clientX, clientY);
    if (!target) {
      this.scheduleHide();
      return;
    }
    this.target = target;
    this.positionAt(target.pos);
  }

  // Find the block whose handle should be shown for a pointer position: the
  // top-level block (direct child of `doc`), except inside a top-level list
  // where we retarget to the specific `list_item` under the pointer so each
  // `li` gets its own handle. Nested content (paragraphs in table cells,
  // blockquotes, nested lists) resolves to its top-level ancestor.
  private resolveTarget(clientX: number, clientY: number): HandleTarget | null {
    const view = this.view;
    if (!view.editable) return null;
    const found = view.posAtCoords({ left: clientX, top: clientY });
    if (!found) return null;
    // Resolve the position nearest the pointer — inside the block for interior
    // hovers. (Note: `found.inside` points *before* the containing node, i.e. a
    // doc-level position for a top-level block, which is not what we want.)
    let $pos = view.state.doc.resolve(found.pos);
    // Exactly on a boundary between top-level blocks: dive into the adjacent
    // one so we still resolve a block rather than the document itself.
    if ($pos.depth === 0) {
      if ($pos.nodeAfter) $pos = view.state.doc.resolve(found.pos + 1);
      else if ($pos.nodeBefore) $pos = view.state.doc.resolve(found.pos - 1);
      else return null;
    }
    if ($pos.depth === 0) return null;

    const topNode = $pos.node(1);
    if (
      $pos.depth >= 2 &&
      (topNode.type.name === 'ordered_list' ||
        topNode.type.name === 'unordered_list')
    ) {
      return { pos: $pos.before(2), isListItem: true };
    }
    return { pos: $pos.before(1), isListItem: false };
  }

  private positionAt(pos: number) {
    const dom = this.view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) {
      this.hide();
      return;
    }
    const parent = this.view.dom.offsetParent as HTMLElement | null;
    if (this.handle.parentNode !== (parent ?? document.body)) {
      (parent ?? document.body).appendChild(this.handle);
    }

    // viewport → offsetParent coordinate conversion, matching
    // dropcursor.ts's updateOverlay()
    let parentLeft: number;
    let parentTop: number;
    if (
      !parent ||
      (parent === document.body && getComputedStyle(parent).position === 'static')
    ) {
      parentLeft = -window.scrollX;
      parentTop = -window.scrollY;
    } else {
      const prect = parent.getBoundingClientRect();
      parentLeft = prect.left - parent.scrollLeft;
      parentTop = prect.top - parent.scrollTop;
    }

    const rect = dom.getBoundingClientRect();
    const style = getComputedStyle(dom);
    let lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      lineHeight = parseFloat(style.fontSize) * 1.5 || rect.height;
    }
    // align the handle's centre to the block's first line, not the whole box
    const firstLineCenter =
      rect.top + Math.min(lineHeight, rect.height) / 2;

    const left = rect.left - parentLeft - HANDLE_SIZE - HANDLE_GAP;
    const top = firstLineCenter - parentTop - HANDLE_SIZE / 2;
    // keep the handle from being clipped off the left edge on tightly-padded
    // (non-"main") editors, where there's little gutter to spare
    this.handle.style.left = `${Math.max(2, left)}px`;
    this.handle.style.top = `${top}px`;
    this.handle.style.display = 'flex';
  }

  private hide() {
    this.handle.style.display = 'none';
    this.target = null;
  }

  private scheduleHide = () => {
    this.cancelScheduledHide();
    this.hideTimeout = window.setTimeout(() => this.hide(), HIDE_DELAY);
  };

  private cancelScheduledHide = () => {
    if (this.hideTimeout != null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  };

  private onDragStart = (event: DragEvent) => {
    const view = this.view;
    if (!this.target || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const { pos, isListItem } = this.target;
    if (!view.state.doc.nodeAt(pos)) {
      event.preventDefault();
      return;
    }
    // Build the drag payload without dispatching a transaction: mutating the
    // doc/selection synchronously inside `dragstart` can abort the native drag
    // in Chromium. `NodeSelection.content()` yields the slice directly, and
    // passing the selection as `node` lets prosemirror-view's drop handler
    // delete the source precisely on a move.
    const selection = NodeSelection.create(view.state.doc, pos);
    const slice = selection.content();
    event.dataTransfer.clearData();
    // browsers only start a drag when *some* data is set
    event.dataTransfer.setData('text/plain', ' ');
    event.dataTransfer.effectAllowed = 'copyMove';
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      event.dataTransfer.setDragImage(dom, 0, 0);
    }

    // `node` lets prosemirror-view delete precisely (node.replace) and remap
    // the source across doc changes; it's absent from the public type
    view.dragging = { slice, move: true, node: selection } as any;
    this.dragState.isListItem = isListItem;
  };

  private onDragEnd = () => {
    // On a successful drop over the editor, prosemirror-view's own drop
    // handler already cleared this. But when the drag is cancelled (dropped
    // outside the editor) nothing else clears it — PM's `dragend` is bound to
    // `view.dom`, not our handle — so a stale slice would linger.
    this.view.dragging = null;
    this.dragState.isListItem = false;
    this.hide();
  };
}

// A `list_item` slice is only structurally valid inside a list, but
// prosemirror-view's replaceRange fitting can still wrap a dropped item into a
// fresh single-item list at the body level. To keep list drags "reorder only",
// cancel any list-item drop whose target isn't already inside a list.
function dropTargetIsInsideList(view: EditorView, event: DragEvent): boolean {
  const found = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!found) return false;
  const $pos = view.state.doc.resolve(found.pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (LIST_TYPES.has($pos.node(depth).type.name)) return true;
  }
  return false;
}

export function blockHandle() {
  const dragState: DragState = { isListItem: false };
  return new Plugin({
    key: blockHandleKey,
    view: view => new BlockHandleView(view, dragState),
    props: {
      handleDrop(view, event) {
        if (!dragState.isListItem) return false;
        // swallow the drop (prevents the move) when a dragged list item would
        // land outside any list
        return !dropTargetIsInsideList(view, event as DragEvent);
      },
    },
  });
}
