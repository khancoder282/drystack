// Adapter over the shared singleton-draft store (@drystack/core/singleton-draft,
// also used by the admin app's SingletonPage.tsx) that keeps the flat
// `singleton::name::field` -> value view the rest of this folder (bind.ts,
// Toolbar.tsx, save.ts, dom-refresh.ts) already speaks, so field-level content
// edited here shows up live in the admin form (and vice versa) without those
// callers needing to change.
import {
  deleteSingletonDraft,
  deleteSingletonDraftFields,
  getAllSingletonDrafts,
  mergeSingletonDraftField,
} from '@drystack/core/singleton-draft';

const DB_NAME = 'drystack-edits';
const META_STORE_NAME = 'meta';

export type PendingEdit = { key: string; value: string; updatedAt: number };

function openMetaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function parseKey(key: string): { name: string; field: string } | undefined {
  const [type, name, field] = key.split('::');
  return type === 'singleton' && name && field ? { name, field } : undefined;
}

export async function getAllEdits(): Promise<PendingEdit[]> {
  const drafts = await getAllSingletonDrafts();
  const edits: PendingEdit[] = [];
  for (const { name, draft } of drafts) {
    for (const [field, value] of Object.entries(draft.state)) {
      if (typeof value !== 'string') continue; // MVP1: fields.text only
      edits.push({
        key: `singleton::${name}::${field}`,
        value,
        updatedAt: draft.savedAt.getTime(),
      });
    }
  }
  return edits;
}

export async function setEdit(key: string, value: string): Promise<void> {
  const parsed = parseKey(key);
  if (!parsed) return;
  await mergeSingletonDraftField(parsed.name, parsed.field, value);
}

export async function deleteEdit(key: string): Promise<void> {
  const parsed = parseKey(key);
  if (!parsed) return;
  await deleteSingletonDraftFields(parsed.name, [parsed.field]);
}

export async function deleteEdits(keys: string[]): Promise<void> {
  const fieldsByName = new Map<string, string[]>();
  for (const key of keys) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    let fields = fieldsByName.get(parsed.name);
    if (!fields) fieldsByName.set(parsed.name, (fields = []));
    fields.push(parsed.field);
  }
  await Promise.all(
    Array.from(fieldsByName, ([name, fields]) =>
      deleteSingletonDraftFields(name, fields)
    )
  );
}

export async function clearEdits(): Promise<void> {
  const drafts = await getAllSingletonDrafts();
  await Promise.all(drafts.map(({ name }) => deleteSingletonDraft(name)));
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openMetaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readonly');
    const req = tx.objectStore(META_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openMetaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readwrite');
    tx.objectStore(META_STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
