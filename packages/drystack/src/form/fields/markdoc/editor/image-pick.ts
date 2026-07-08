import {
  MediaLibraryPick,
  UNHYDRATED_MEDIA_BYTES,
} from '../../../../app/media-library/bridge';

// decides whether a picked image should be embedded (bytes stored as a
// sibling file of this entry) or referenced (an unhydrated node pointing at
// the shared library directory, resolved lazily) — references are only safe
// where the field's serialization format supports resolving them back, see
// `EditorConfig.supportsMediaLibraryReferences`
export function imageAttrsForPick(
  picked: MediaLibraryPick,
  transformFilename: (originalFilename: string) => string,
  supportsMediaLibraryReferences: boolean
): { src: Uint8Array; filename: string } {
  const filename = transformFilename(picked.filename);
  if (picked.source === 'library' && supportsMediaLibraryReferences) {
    return { src: UNHYDRATED_MEDIA_BYTES, filename };
  }
  return { src: picked.content, filename };
}
