import { EditorState } from 'prosemirror-state';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { yXmlFragmentToProsemirror } from 'y-prosemirror';

import { createEditorState } from '../markdoc/editor/editor-state';
import { EditorSchema } from '../markdoc/editor/schema';
import { htmlToProseMirror } from '../markdoc/editor/html/parse';
import { serializeFromEditorStateToHTML } from '../markdoc/editor/html/serialize';

export { createEditorSchema } from '../markdoc/editor/schema';
export { DocumentFieldInput } from '../markdoc/ui';
export { prosemirrorToYXmlFragment } from 'y-prosemirror';

export function getDefaultValue(schema: EditorSchema) {
  return createEditorState(schema.nodes.doc.createAndFill()!);
}

export function parseToEditorStateHTML(
  content: string,
  schema: EditorSchema,
  files: ReadonlyMap<string, Uint8Array>,
  otherFiles: ReadonlyMap<string, ReadonlyMap<string, Uint8Array>>
) {
  const doc = htmlToProseMirror(content, schema, files, otherFiles);
  return createEditorState(doc);
}

export function serializeFromEditorStateHTML(value: EditorState) {
  return serializeFromEditorStateToHTML(value.doc);
}

export function createEditorStateFromYJS(
  schema: EditorSchema,
  yXmlFragment: Y.XmlFragment,
  awareness: Awareness
) {
  return createEditorState(
    yXmlFragmentToProsemirror(schema.schema, yXmlFragment),
    undefined,
    undefined,
    yXmlFragment,
    awareness
  );
}
