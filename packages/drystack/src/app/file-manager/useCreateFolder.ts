import { useCallback } from 'react';
import { base64Encode } from '#base64';
import { useRouter } from '../router';
import { hydrateTreeCacheWithEntries } from '../shell/data';

// there's no such thing as an empty folder in this app's git-backed storage
// model (see `collectEntriesInDir`/`updateTreeWithChanges`, which drop any
// tree node with no blob descendants) — a folder only exists once it
// contains a file, so creating one means writing a placeholder blob inside it
const PLACEHOLDER_FILENAME = '.gitkeep';

export function useCreateFolder() {
  const { basePath } = useRouter();

  const createFolder = useCallback(
    async (directory: string, name: string) => {
      const res = await fetch(`/api${basePath}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'no-cors': '1' },
        body: JSON.stringify({
          additions: [
            {
              path: `${directory}/${name}/${PLACEHOLDER_FILENAME}`,
              contents: base64Encode(new Uint8Array()),
            },
          ],
          deletions: [],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newTree = await res.json();
      return hydrateTreeCacheWithEntries(newTree);
    },
    [basePath]
  );

  return { createFolder };
}
