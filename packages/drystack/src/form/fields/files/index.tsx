import { BasicFormField } from '../../api';
import { FieldDataError } from '../error';
import {
  RequiredValidation,
  assertRequired,
  basicFormFieldWithSimpleReaderParse,
} from '../utils';
import { FilesFieldInput } from '#field-ui/files';

export function files<IsRequired extends boolean | undefined>({
  label,
  validation,
  description,
}: {
  label: string;
  validation?: { isRequired?: IsRequired };
  description?: string;
} & RequiredValidation<IsRequired>): BasicFormField<
  string[],
  string[],
  string[]
> {
  return basicFormFieldWithSimpleReaderParse<string[], string[]>({
    label,
    columnKind: 'files',
    Input(props) {
      return (
        <FilesFieldInput
          label={label}
          description={description}
          validation={validation}
          {...props}
        />
      );
    },
    defaultValue() {
      return [];
    },
    parse(value) {
      if (value === undefined) return [];
      if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
        throw new FieldDataError('Must be an array of file paths');
      }
      return value;
    },
    serialize(value) {
      return { value: value.length ? value : undefined };
    },
    validate(value) {
      assertRequired(value.length > 0 ? value : null, validation, label);
      return value;
    },
  });
}
