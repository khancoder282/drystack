import { useEffect, useState } from 'react';
import { ActionButton, Button, ButtonGroup } from '@keystar/ui/button';
import { Dialog, DialogContainer, useDialogContainer } from '@keystar/ui/dialog';
import { Icon } from '@keystar/ui/icon';
import { fileUpIcon } from '@keystar/ui/icon/icons/fileUpIcon';
import { imageIcon } from '@keystar/ui/icon/icons/imageIcon';
import { fileCodeIcon } from '@keystar/ui/icon/icons/fileCodeIcon';
import { Content, Footer } from '@keystar/ui/slots';
import { Flex } from '@keystar/ui/layout';
import { Heading, Text } from '@keystar/ui/typography';
import { tokenSchema } from '@keystar/ui/style';

import { useBaseCommit, useRepoInfo } from '../shell/data';
import { useConfig } from '../shell/context';
import { useRouter } from '../router';
import { fetchBlob } from '../useItemData';
import { MediaLibraryPick, registerMediaLibraryOpener } from './bridge';
import { useMediaLibraryEntries } from './useMediaLibraryEntries';
import { useMediaLibraryUpload } from './useMediaLibraryUpload';
import { getUploadedFileObject } from '../../form/fields/image/ui';

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'avif',
]);

function isImagePath(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.has(ext);
}

function filenameOf(path: string) {
  return path.split('/').pop()!;
}

type MediaAsset =
  | { source: 'tree'; path: string; sha: string }
  | { source: 'upload'; path: string; content: Uint8Array };

function useAssetObjectURL(asset: MediaAsset): string | null {
  const config = useConfig();
  const baseCommit = useBaseCommit();
  const repoInfo = useRepoInfo();
  const { basePath } = useRouter();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = isImagePath(asset.path);

  useEffect(() => {
    if (!isImage) return;
    if (asset.source === 'upload') {
      const url = URL.createObjectURL(new Blob([asset.content]));
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    Promise.resolve(
      fetchBlob(config, asset.sha, asset.path, baseCommit, repoInfo, basePath)
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
  }, [asset.source, asset.path, asset.source === 'tree' ? asset.sha : '']);

  return objectUrl;
}

function MediaLibraryAssetButton(props: {
  asset: MediaAsset;
  onPick: (pick: MediaLibraryPick) => void;
}) {
  const { asset } = props;
  const config = useConfig();
  const baseCommit = useBaseCommit();
  const repoInfo = useRepoInfo();
  const { basePath } = useRouter();
  const objectUrl = useAssetObjectURL(asset);
  const isImage = isImagePath(asset.path);

  return (
    <ActionButton
      onPress={async () => {
        const content =
          asset.source === 'upload'
            ? asset.content
            : await fetchBlob(
                config,
                asset.sha,
                asset.path,
                baseCommit,
                repoInfo,
                basePath
              );
        props.onPick({
          path: `/${asset.path}`,
          filename: filenameOf(asset.path),
          content,
        });
      }}
    >
      <Flex
        direction="column"
        gap="small"
        alignItems="center"
        UNSAFE_style={{ width: 140 }}
      >
        {objectUrl ? (
          <img
            src={objectUrl}
            alt=""
            style={{
              display: 'block',
              maxHeight: 96,
              maxWidth: '100%',
              borderRadius: tokenSchema.size.radius.regular,
            }}
          />
        ) : (
          <Icon src={isImage ? imageIcon : fileCodeIcon} size="large" />
        )}
        <Text
          size="small"
          UNSAFE_style={{
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filenameOf(asset.path)}
        </Text>
      </Flex>
    </ActionButton>
  );
}

function MediaLibraryDialogContent(props: {
  accept: 'image' | 'any' | undefined;
  onPick: (pick: MediaLibraryPick | undefined) => void;
}) {
  const { dismiss } = useDialogContainer();
  const treeEntries = useMediaLibraryEntries();
  const [sessionUploads, setSessionUploads] = useState<
    { path: string; content: Uint8Array }[]
  >([]);
  const upload = useMediaLibraryUpload();
  const [isUploading, setIsUploading] = useState(false);

  const assets: MediaAsset[] = [
    ...sessionUploads.map(
      (u): MediaAsset => ({ source: 'upload', path: u.path, content: u.content })
    ),
    ...treeEntries
      .filter(entry => !sessionUploads.some(u => u.path === entry.path))
      .map((entry): MediaAsset => ({ source: 'tree', path: entry.path, sha: entry.sha })),
  ].filter(asset => (props.accept === 'image' ? isImagePath(asset.path) : true));

  return (
    <Dialog size="large">
      <Heading>Media library</Heading>
      <Content>
        <Flex direction="column" gap="large">
          {assets.length === 0 && (
            <Text color="neutralTertiary">No files yet. Upload one below.</Text>
          )}
          <Flex wrap gap="regular">
            {assets.map(asset => (
              <MediaLibraryAssetButton
                key={asset.path}
                asset={asset}
                onPick={props.onPick}
              />
            ))}
          </Flex>
        </Flex>
      </Content>
      <Footer>
        <ActionButton
          isDisabled={isUploading}
          onPress={async () => {
            const file = await getUploadedFileObject(
              props.accept === 'image' ? 'image/*' : ''
            );
            if (!file) return;
            setIsUploading(true);
            try {
              const content = new Uint8Array(await file.arrayBuffer());
              const existingPaths = new Set([
                ...treeEntries.map(entry => entry.path),
                ...sessionUploads.map(u => u.path),
              ]);
              const path = await upload(content, file.name, existingPaths);
              const relativePath = path.replace(/^\/+/, '');
              setSessionUploads(prev => [...prev, { path: relativePath, content }]);
              props.onPick({ path, filename: filenameOf(path), content });
            } finally {
              setIsUploading(false);
            }
          }}
        >
          <Icon src={fileUpIcon} />
          <Text>{isUploading ? 'Uploading…' : 'Upload new file'}</Text>
        </ActionButton>
      </Footer>
      <ButtonGroup>
        <Button onPress={dismiss}>Cancel</Button>
      </ButtonGroup>
    </Dialog>
  );
}

export function MediaLibraryHost() {
  const [request, setRequest] = useState<{
    accept: 'image' | 'any' | undefined;
    resolve: (pick: MediaLibraryPick | undefined) => void;
  } | null>(null);

  useEffect(() => {
    registerMediaLibraryOpener(options => {
      return new Promise(resolve => {
        setRequest({ accept: options?.accept, resolve });
      });
    });
    return () => registerMediaLibraryOpener(null);
  }, []);

  const resolveAndClose = (pick: MediaLibraryPick | undefined) => {
    request?.resolve(pick);
    setRequest(null);
  };

  return (
    <DialogContainer onDismiss={() => resolveAndClose(undefined)}>
      {request && (
        <MediaLibraryDialogContent
          accept={request.accept}
          onPick={resolveAndClose}
        />
      )}
    </DialogContainer>
  );
}
