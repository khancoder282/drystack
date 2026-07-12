import type { Config } from '@drystack/core';
import { getAllEdits, setEdit, clearEdits, getMeta, setMeta } from './store';
import { getLatestFieldValues } from './save';

const BUILD_VERSION_KEY = 'buildVersion';

let editing = false;
let onChangeCallback: (() => void) | undefined;

// The server-rendered (on-disk) value for each editable key, captured before
// any pending edit is painted over it. Lets the review dialog show a
// before/after diff entirely client-side — no file-read round-trip needed.
const originalValues = new Map<string, string>();

function rememberOriginal(key: string, value: string) {
  if (!originalValues.has(key)) originalValues.set(key, value);
}

export function getOriginalValue(key: string): string | undefined {
  return originalValues.get(key);
}

// Force the diff baseline for `key` to `value`, overwriting any existing
// baseline. Used after a deploy ships: the value now live on the server *is*
// `value`, so the next edit to this field should diff against it rather than
// whatever was on screen before the just-shipped edit.
export function resetOriginalValue(key: string, value: string) {
  originalValues.set(key, value);
}

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
    const key = el.getAttribute('data-dry');
    // No pending edit was painted here, so the current text is the on-disk
    // value — safe to snapshot now as the diff baseline.
    if (key) rememberOriginal(key, el.textContent ?? '');
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

// Cloudflare Pages builds fresh on every deploy, so buildVersion (a build-time
// timestamp) increases with each deploy. Only github-hosted content can drift
// out from under a browser's IndexedDB this way — a Cloudflare build finishing
// after this tab loaded means the DOM it applies edits onto is stale — so
// local mode (always serving whatever's on disk right now) skips this check.
//
// The stored high-water mark only ever moves forward. A lower buildVersion
// than what's stored isn't a rollback signal worth acting on — it's what a
// CDN edge node serving a not-yet-updated cache during rollout looks like —
// so it's ignored entirely: no clear, and the stored mark isn't dragged back
// down (which would otherwise make a later, merely-stale-again reload look
// like a "new" deploy and wrongly clear edits made in between).
export async function discardEditsIfBuildIsNewer(
  config: Config<any, any>,
  buildVersion: number | undefined
): Promise<void> {
  if (config.storage.kind !== 'github' || buildVersion == null) return;
  const lastSeen = await getMeta<number>(BUILD_VERSION_KEY);
  if (lastSeen == null) {
    await setMeta(BUILD_VERSION_KEY, buildVersion);
    return;
  }
  if (buildVersion > lastSeen) {
    await clearEdits();
    await setMeta(BUILD_VERSION_KEY, buildVersion);
  }
}

// Re-reads every on-page singleton straight from its real source (local API,
// or the GitHub Contents API at the default branch) and repaints any field
// that has no pending edit — called when entering edit mode so a visitor
// starts from what's actually on disk/GitHub, not from HTML that may be
// stale (a github-mode page can be served from a Cloudflare CDN edge that
// hasn't caught up with the latest deploy yet). Fields with a pending edit
// are left alone: unsaved typed content always wins over a fresh fetch.
// Best-effort — a fetch failure (e.g. no GitHub auth cookie) just leaves the
// server-rendered text in place rather than blocking edit mode.
export async function refreshFromLatestSource(
  config: Config<any, any>
): Promise<void> {
  const singletonNames = new Set<string>();
  document.querySelectorAll<HTMLElement>('[data-dry]').forEach(el => {
    const [type, name] = el.getAttribute('data-dry')?.split('::') ?? [];
    if (type === 'singleton' && name) singletonNames.add(name);
  });

  const pendingKeys = new Set((await getAllEdits()).map(edit => edit.key));

  await Promise.all(
    Array.from(singletonNames, async name => {
      let latest: Record<string, string>;
      try {
        latest = await getLatestFieldValues(config, name);
      } catch {
        return;
      }
      document
        .querySelectorAll<HTMLElement>(
          `[data-dry^="singleton::${CSS.escape(name)}::"]`
        )
        .forEach(el => {
          const key = el.getAttribute('data-dry')!;
          if (pendingKeys.has(key)) return;
          const field = key.split('::')[2];
          const value = latest[field];
          if (value === undefined) return;
          resetOriginalValue(key, value);
          el.textContent = value;
        });
    })
  );
}

// Applies edits saved in IndexedDB on top of the server-rendered DOM — runs
// on every page load (even before Edit mode is turned on) so an unsaved edit
// survives a reload, per plan.md's "chưa lưu thì reload phải lấy IndexDB".
export async function applyPendingEdits(): Promise<number> {
  const edits = await getAllEdits();
  for (const edit of edits) {
    // A field can be rendered more than once on a page (e.g. a site title in
    // both the header and footer) — every element sharing this key must get
    // the pending edit, not just the first match in document order.
    const els = document.querySelectorAll<HTMLElement>(
      `[data-dry="${CSS.escape(edit.key)}"]`
    );
    els.forEach(el => {
      // Capture the on-disk value before overwriting it with the pending edit.
      rememberOriginal(edit.key, el.textContent ?? '');
      el.textContent = edit.value;
    });
  }
  return edits.length;
}
