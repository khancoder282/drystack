export type MediaLibraryPick = {
  path: string;
  filename: string;
  content: Uint8Array;
};

type Opener = (options?: {
  accept?: 'image' | 'any';
}) => Promise<MediaLibraryPick | undefined>;

let currentOpener: Opener | null = null;

export function registerMediaLibraryOpener(opener: Opener | null) {
  currentOpener = opener;
}

export function openMediaLibrary(options?: {
  accept?: 'image' | 'any';
}): Promise<MediaLibraryPick | undefined> {
  if (!currentOpener) {
    // eslint-disable-next-line no-console
    console.warn('Media library is not available yet');
    return Promise.resolve(undefined);
  }
  return currentOpener(options);
}
