// Shared draft storage for singletons, used by both the admin app
// (SingletonPage.tsx) and the astro package's on-page visual editor
// (packages/astro/src/editor/). The two write to and read from the exact
// same IndexedDB entry per singleton so an in-progress edit made in one
// surface is immediately visible in the other, and a BroadcastChannel
// notifies same-browser tabs so they can repaint without a reload.
//
// Deliberately dependency-light (idb-keyval only, no React/schema/yaml) so
// importing it from the astro editor bundle — which anonymous site visitors
// never download, but which is still size-sensitive — stays cheap.
import { createStore, get, set, del, entries, UseStore } from 'idb-keyval';

export type SingletonDraft = {
  state: Record<string, unknown>;
  treeKey: string | undefined;
  savedAt: Date;
};

let store: UseStore;
function getStore() {
  if (!store) {
    store = createStore('drystack', 'items');
  }
  return store;
}

function draftKey(name: string) {
  return ['singleton', name] as const;
}

const channel =
  typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('drystack-singleton-draft')
    : undefined;

function notifyDraftChanged(name: string) {
  channel?.postMessage(name);
}

// Subscribes to drafts changing in *other* tabs/contexts (BroadcastChannel
// never delivers a message back to the sender). Returns an unsubscribe fn.
export function onSingletonDraftChanged(
  cb: (name: string) => void
): () => void {
  if (!channel) return () => {};
  const handler = (e: MessageEvent<string>) => cb(e.data);
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

function isValidDraft(raw: unknown): raw is SingletonDraft {
  return (
    !!raw &&
    typeof raw === 'object' &&
    typeof (raw as any).state === 'object' &&
    (raw as any).savedAt instanceof Date
  );
}

export async function getSingletonDraft(
  name: string
): Promise<SingletonDraft | undefined> {
  const raw = await get(draftKey(name) as any, getStore());
  return isValidDraft(raw) ? raw : undefined;
}

// Every singleton that currently has a draft — the visual editor's Save
// flow needs to gather pending fields across every singleton ever edited in
// this browser, not just the ones rendered on the current page. Shares the
// `drystack`/`items` IndexedDB store with collection drafts (persistence.tsx),
// so this filters down to `['singleton', name]` keys only.
export async function getAllSingletonDrafts(): Promise<
  { name: string; draft: SingletonDraft }[]
> {
  const all = await entries(getStore());
  const result: { name: string; draft: SingletonDraft }[] = [];
  for (const [key, raw] of all) {
    if (!Array.isArray(key) || key[0] !== 'singleton') continue;
    if (!isValidDraft(raw)) continue;
    result.push({ name: key[1] as string, draft: raw });
  }
  return result;
}

export async function setSingletonDraft(
  name: string,
  state: Record<string, unknown>,
  treeKey: string | undefined
): Promise<void> {
  const data: SingletonDraft = { state, treeKey, savedAt: new Date() };
  await set(draftKey(name) as any, data, getStore());
  notifyDraftChanged(name);
}

// Merges a single field's value into the singleton's existing draft (or
// starts a new one) — used by the visual editor, which only ever knows
// about the one `fields.text` field the visitor just typed into.
export async function mergeSingletonDraftField(
  name: string,
  field: string,
  value: string
): Promise<void> {
  const existing = await getSingletonDraft(name);
  const data: SingletonDraft = {
    state: { ...existing?.state, [field]: value },
    treeKey: existing?.treeKey,
    savedAt: new Date(),
  };
  await set(draftKey(name) as any, data, getStore());
  notifyDraftChanged(name);
}

export async function deleteSingletonDraft(name: string): Promise<void> {
  await del(draftKey(name) as any, getStore());
  notifyDraftChanged(name);
}

// Removes only the given fields from a singleton's draft — used after a
// deploy ships so a second, still-in-flight save (or an edit typed after
// this one was already committed) doesn't get wiped out along with it.
// Deletes the whole entry once no fields are left.
export async function deleteSingletonDraftFields(
  name: string,
  fields: string[]
): Promise<void> {
  const existing = await getSingletonDraft(name);
  if (!existing) return;
  const state = { ...existing.state };
  for (const field of fields) delete state[field];
  if (Object.keys(state).length === 0) {
    await del(draftKey(name) as any, getStore());
  } else {
    await set(
      draftKey(name) as any,
      { state, treeKey: existing.treeKey, savedAt: existing.savedAt },
      getStore()
    );
  }
  notifyDraftChanged(name);
}
