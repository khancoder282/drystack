// a scope for the entry-local tab in the media library dialog, e.g. the
// directory a collection item's own sibling images are stored under
export type MediaLibraryLocalScope = {
  directory: string;
  label: string;
};

export type MediaLibraryPick = {
  path: string;
  filename: string;
  content: Uint8Array;
  // 'library' picks reference the shared, public directory (durable, reused
  // across entries); 'local' picks are scoped to the current entry and are
  // meant to be embedded directly into that entry's own content
  source: 'library' | 'local';
};

// placeholder bytes for a media node that isn't embedding its content, but
// instead referencing a file in the shared library directory by filename —
// only meaningful where the caller has real bytes-lazy-resolution support
// (see resolveMediaLibraryBytes); byteLength (not identity) is what's checked
export const UNHYDRATED_MEDIA_BYTES = new Uint8Array(0);

type OpenOptions = {
  accept?: 'image' | 'any';
  local?: MediaLibraryLocalScope;
};

type Opener = (
  options: OpenOptions & { selection: 'single' | 'multi' }
) => Promise<MediaLibraryPick[] | undefined>;

let currentOpener: Opener | null = null;

export function registerMediaLibraryOpener(opener: Opener | null) {
  currentOpener = opener;
}

export function openMediaLibrary(
  options?: OpenOptions
): Promise<MediaLibraryPick | undefined> {
  if (!currentOpener) {
    // eslint-disable-next-line no-console
    console.warn('Media library is not available yet');
    return Promise.resolve(undefined);
  }
  return currentOpener({ ...options, selection: 'single' }).then(
    picks => picks?.[0]
  );
}

// multi-select variant used by `fields.images`/`fields.files` and the File
// Management page — resolves every file picked/uploaded in one dialog
// session, instead of just the first
export function openMediaLibraryMulti(
  options?: OpenOptions
): Promise<MediaLibraryPick[] | undefined> {
  if (!currentOpener) {
    // eslint-disable-next-line no-console
    console.warn('Media library is not available yet');
    return Promise.resolve(undefined);
  }
  return currentOpener({ ...options, selection: 'multi' });
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
