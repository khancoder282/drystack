import { useMemo } from 'react';
import { useTree } from '../shell/data';
import { TreeEntry } from '../trees';
import { MEDIA_LIBRARY_DIRECTORY } from './constants';

export function useMediaLibraryEntries(): TreeEntry[] {
  const tree = useTree().current;
  return useMemo(() => {
    if (tree.kind !== 'loaded') return [];
    const prefix = `${MEDIA_LIBRARY_DIRECTORY}/`;
    return [...tree.data.entries.values()]
      .filter(entry => entry.type === 'blob' && entry.path.startsWith(prefix))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [tree]);
}
