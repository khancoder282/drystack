import { ContentFormField } from '../../api';
import {
  DocumentFieldInput,
  getDefaultValue,
  serializeFromEditorStateHTML,
  createEditorSchema,
  parseToEditorStateHTML,
  createEditorStateFromYJS,
  prosemirrorToYXmlFragment,
} from '#field-ui/content';
import type { EditorSchema } from '../markdoc/editor/schema';
import type { EditorState } from 'prosemirror-state';
import {
  MarkdocEditorOptions,
  editorOptionsToConfig,
} from '../markdoc/config';
import type { XmlFragment } from 'yjs';
import { MEDIA_LIBRARY_DIRECTORY } from '../../../app/media-library/constants';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export function content({
  label,
  description,
  options = {},
}: {
  label: string;
  description?: string;
  options?: Omit<MarkdocEditorOptions, 'image'> & {
    image?: boolean;
  };
}): content.Field {
  let schema: undefined | EditorSchema;
  const config = editorOptionsToConfig(options);
  const getSchema = () => {
    if (!schema) {
      schema = createEditorSchema(config, {}, false);
    }
    return schema;
  };
  return {
    kind: 'form',
    formKind: 'content',
    defaultValue() {
      return getDefaultValue(getSchema());
    },
    Input(props) {
      return (
        <DocumentFieldInput
          description={description}
          label={label}
          {...props}
        />
      );
    },
    parse: (_, { content, other, external }) => {
      const text = textDecoder.decode(content);
      return parseToEditorStateHTML(text, getSchema(), other, external);
    },
    contentExtension: '.html',
    validate(value) {
      return value;
    },
    directories: [MEDIA_LIBRARY_DIRECTORY],
    serialize(value) {
      const out = serializeFromEditorStateHTML(value);
      return {
        content: textEncoder.encode(out.content),
        external: out.external,
        other: out.other,
        value: undefined,
      };
    },
    reader: {
      parse: (_, { content }) => {
        return content ? textDecoder.decode(content) : '';
      },
    },
    collaboration: {
      toYjs(value) {
        return prosemirrorToYXmlFragment(value.doc);
      },
      fromYjs(yjsValue, awareness) {
        return createEditorStateFromYJS(
          getSchema(),
          yjsValue as XmlFragment,
          awareness
        );
      },
    },
  };
}

export declare namespace content {
  type Field = ContentFormField<EditorState, EditorState, string>;
}
