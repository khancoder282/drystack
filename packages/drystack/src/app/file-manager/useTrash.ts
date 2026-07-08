import { useCallback } from 'react';
import { base64Encode } from '#base64';
import { useConfig } from '../shell/context';
import { useBaseCommit, useRepoInfo, useTree, hydrateTreeCacheWithEntries } from '../shell/data';
import { useRouter } from '../router';
import { fetchBlob } from '../useItemData';
import { getTreeNodeAtPath, TreeEntry } from '../trees';
import { TRASH_DIRECTORY } from './constants';

export function trashedPathFor(path: string) {
  return `${TRASH_DIRECTORY}/${path}`;
}

export function originalPathFor(trashedPath: string) {
  return trashedPath.slice(TRASH_DIRECTORY.length + 1);
}

export function isTrashedPath(path: string) {
  return path === TRASH_DIRECTORY || path.startsWith(`${TRASH_DIRECTORY}/`);
}

// every blob whose path lives under `dir` (not including `dir` itself)
export function descendantBlobPaths(
  entries: ReadonlyMap<string, TreeEntry>,
  dir: string
): TreeEntry[] {
  const prefix = `${dir}/`;
  return [...entries.values()].filter(
    entry => entry.type === 'blob' && entry.path.startsWith(prefix)
  );
}

async function postUpdate(
  basePath: string,
  additions: { path: string; contents: string }[],
  deletions: { path: string }[]
) {
  const res = await fetch(`/api${basePath}/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'no-cors': '1',
    },
    body: JSON.stringify({ additions, deletions }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const newTree = await res.json();
  return hydrateTreeCacheWithEntries(newTree);
}

// Trash/restore are emulated as a single `/update` call that both writes the
// bytes at the new location (`additions`) and removes the old path
// (`deletions`) — there's no dedicated move/rename endpoint on the server.
export function useTrash() {
  const config = useConfig();
  const baseCommit = useBaseCommit();
  const repoInfo = useRepoInfo();
  const { basePath } = useRouter();
  const tree = useTree().current;

  const movePaths = useCallback(
    async (paths: readonly string[], transform: (path: string) => string) => {
      if (tree.kind !== 'loaded' || paths.length === 0) return undefined;
      const additions = await Promise.all(
        paths.map(async path => {
          const sha = getTreeNodeAtPath(tree.data.tree, path)?.entry.sha;
          if (!sha) return null;
          const contents = await fetchBlob(
            config,
            sha,
            path,
            baseCommit,
            repoInfo,
            basePath
          );
          return { path: transform(path), contents: base64Encode(contents) };
        })
      );
      return postUpdate(
        basePath,
        additions.filter((x): x is NonNullable<typeof x> => x !== null),
        paths.map(path => ({ path }))
      );
    },
    [tree, config, baseCommit, repoInfo, basePath]
  );

  const trashPaths = useCallback(
    (paths: readonly string[]) => movePaths(paths, trashedPathFor),
    [movePaths]
  );

  const restorePaths = useCallback(
    (paths: readonly string[]) => movePaths(paths, originalPathFor),
    [movePaths]
  );

  // a directory-shaped path here removes everything under it in one go
  // (server's fs.rm is called with recursive:true)
  const permanentlyDelete = useCallback(
    (paths: readonly string[]) =>
      postUpdate(
        basePath,
        [],
        paths.map(path => ({ path }))
      ),
    [basePath]
  );

  return { trashPaths, restorePaths, permanentlyDelete };
}
