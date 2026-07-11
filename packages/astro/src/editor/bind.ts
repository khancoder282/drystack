import { getAllEdits, setEdit } from './store';

let editing = false;
let onChangeCallback: (() => void) | undefined;

function handleInput(e: Event) {
  const el = (e.target as HTMLElement)?.closest<HTMLElement>('[data-dry]');
  if (!el) return;
  const key = el.getAttribute('data-dry');
  if (!key) return;
  setEdit(key, el.textContent ?? '').then(() => onChangeCallback?.());
}

export function isEditing() {
  return editing;
}

export function enableEditing(onChange?: () => void) {
  editing = true;
  onChangeCallback = onChange;
  document.body.classList.add('editing');
  document.querySelectorAll<HTMLElement>('[data-dry]').forEach(el => {
    el.contentEditable = 'plaintext-only';
    // Firefox versions without plaintext-only support silently ignore it.
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  });
  document.addEventListener('input', handleInput, true);
}

export function disableEditing() {
  editing = false;
  document.body.classList.remove('editing');
  document.querySelectorAll<HTMLElement>('[data-dry]').forEach(el => {
    el.removeAttribute('contenteditable');
  });
  document.removeEventListener('input', handleInput, true);
}

// Applies edits saved in IndexedDB on top of the server-rendered DOM — runs
// on every page load (even before Edit mode is turned on) so an unsaved edit
// survives a reload, per plan.md's "chưa lưu thì reload phải lấy IndexDB".
export async function applyPendingEdits(): Promise<number> {
  const edits = await getAllEdits();
  for (const edit of edits) {
    const el = document.querySelector<HTMLElement>(
      `[data-dry="${CSS.escape(edit.key)}"]`
    );
    if (el) el.textContent = edit.value;
  }
  return edits.length;
}
