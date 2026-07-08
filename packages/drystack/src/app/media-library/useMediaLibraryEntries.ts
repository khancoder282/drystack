import { useMemo } from 'react';
import { useTree } from '../shell/data';
import { TreeEntry } from '../trees';

export function useDirectoryEntries(directory: string): TreeEntry[] {
  const tree = useTree().current;
  return useMemo(() => {
    if (tree.kind !== 'loaded') return [];
    const prefix = `${directory}/`;
    return [...tree.data.entries.values()]
      .filter(entry => entry.type === 'blob' && entry.path.startsWith(prefix))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [tree, directory]);
}
