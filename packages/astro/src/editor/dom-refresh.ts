import { Idiomorph } from 'idiomorph';
import { deleteEdits } from './store';
import { resetOriginalValue } from './bind';

// Called once a build carrying this tab's edits has shipped. Swaps the live
// DOM for the freshly deployed HTML in place — no `location.reload()` — so
// the page doesn't flash/lose scroll position, then clears the edits that
// just shipped and re-baselines their diff origin against the new server
// value (so a follow-up edit to the same field diffs against what's actually
// live now, not against whatever was on screen before the shipped edit).
//
// Only deletes `editedKeys` (this deploy's own keys) — not the whole store.
// A second Save can start (and start its own trackDeploy) while this one is
// still building, since the toolbar re-enables Save right after the commit
// is created, well before the build finishes. Clearing everything here would
// wipe that second commit's still-in-flight edits, or any edit the user had
// typed but never saved, out from under it.
export async function refreshAfterDeploy(editedKeys: string[]): Promise<void> {
  const res = await fetch(location.pathname + location.search, {
    cache: 'reload',
  });
  if (!res.ok) return;
  const html = await res.text();
  const newDoc = new DOMParser().parseFromString(html, 'text/html');

  const editorRoot = document.getElementById('drystack-editor-root');
  editorRoot?.remove();

  Idiomorph.morph(document.body, newDoc.body, { morphStyle: 'innerHTML' });
  if (newDoc.title) document.title = newDoc.title;

  if (editorRoot) document.body.appendChild(editorRoot);

  await deleteEdits(editedKeys);
  for (const key of editedKeys) {
    const el = document.querySelector<HTMLElement>(`[data-dry="${CSS.escape(key)}"]`);
    if (el) resetOriginalValue(key, el.textContent ?? '');
  }
}
