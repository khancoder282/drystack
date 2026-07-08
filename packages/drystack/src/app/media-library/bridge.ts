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

// lets code outside the editor (drag & drop, paste) durably persist bytes to
// the media library directory immediately, the same way picking a file in
// the dialog does, without going through the entry's own save/serialize step
type Uploader = (
  content: Uint8Array,
  filename: string
) => Promise<{ path: string; filename: string }>;

let currentUploader: Uploader | null = null;

export function registerMediaLibraryUploader(uploader: Uploader | null) {
  currentUploader = uploader;
}

export function uploadToMediaLibrary(
  content: Uint8Array,
  filename: string
): Promise<{ path: string; filename: string } | undefined> {
  if (!currentUploader) {
    // eslint-disable-next-line no-console
    console.warn('Media library is not available yet');
    return Promise.resolve(undefined);
  }
  return currentUploader(content, filename);
}

// lets the shared `image` node view resolve real bytes for a filename that
// was parsed from stored HTML without any bytes embedded (see html/parse.ts)
type BytesResolver = (filename: string) => Promise<Uint8Array | undefined>;

let currentBytesResolver: BytesResolver | null = null;

export function registerMediaLibraryBytesResolver(
  resolver: BytesResolver | null
) {
  currentBytesResolver = resolver;
}

export function resolveMediaLibraryBytes(
  filename: string
): Promise<Uint8Array | undefined> {
  if (!currentBytesResolver) return Promise.resolve(undefined);
  return currentBytesResolver(filename);
}
