import { BasicFormField } from '../../api';
import { FieldDataError } from '../error';
import {
  DocumentFieldInput,
  getDefaultValue,
  serializeFromEditorStateHTML,
  createEditorSchema,
  parseToEditorStateHTML,
} from '#field-ui/content';
import type { EditorSchema } from '../markdoc/editor/schema';
import type { EditorState } from 'prosemirror-state';
import {
  MarkdocEditorOptions,
  editorOptionsToConfig,
} from '../markdoc/config';

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
    parse(value) {
      if (value === undefined) return getDefaultValue(getSchema());
      if (typeof value !== 'string') {
        throw new FieldDataError('Must be a string');
      }
      return parseToEditorStateHTML(value, getSchema());
    },
    validate(value) {
      return value;
    },
    serialize(value) {
      return { value: serializeFromEditorStateHTML(value) };
    },
    reader: {
      parse(value) {
        if (typeof value !== 'string') return '';
        return value;
      },
    },
  };
}

export declare namespace content {
  type Field = BasicFormField<EditorState, EditorState, string>;
}
