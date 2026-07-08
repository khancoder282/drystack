import { useEffect, useState } from 'react';
import { useConfig } from '../shell/context';
import { useBaseCommit, useRepoInfo, useTree } from '../shell/data';
import { useRouter } from '../router';
import { fetchBlob } from '../useItemData';
import { getTreeNodeAtPath } from '../trees';

export function useMediaLibraryPreviewURL(path: string | null) {
  const config = useConfig();
  const baseCommit = useBaseCommit();
  const repoInfo = useRepoInfo();
  const { basePath } = useRouter();
  const tree = useTree().current;
  const relativePath = path?.replace(/^\/+/, '');
  const sha =
    relativePath && tree.kind === 'loaded'
      ? getTreeNodeAtPath(tree.data.tree, relativePath)?.entry.sha
      : undefined;

  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!relativePath || !sha) {
      setObjectUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    Promise.resolve(
      fetchBlob(config, sha, relativePath, baseCommit, repoInfo, basePath)
    ).then(bytes => {
      if (cancelled) return;
      createdUrl = URL.createObjectURL(new Blob([bytes]));
      setObjectUrl(createdUrl);
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relativePath, sha, basePath]);

  return objectUrl;
}
