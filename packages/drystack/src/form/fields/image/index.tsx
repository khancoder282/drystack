import { BasicFormField } from '../../api';
import { FieldDataError } from '../error';
import {
  RequiredValidation,
  assertRequired,
  basicFormFieldWithSimpleReaderParse,
} from '../utils';
import { ImageFieldInput } from '#field-ui/image';

export function image<IsRequired extends boolean | undefined>({
  label,
  validation,
  description,
}: {
  label: string;
  validation?: { isRequired?: IsRequired };
  description?: string;
} & RequiredValidation<IsRequired>): BasicFormField<
  string | null,
  string | (IsRequired extends true ? never : null),
  string | (IsRequired extends true ? never : null)
> {
  return basicFormFieldWithSimpleReaderParse<
    string | null,
    string | (IsRequired extends true ? never : null)
  >({
    label,
    Input(props) {
      return (
        <ImageFieldInput
          label={label}
          description={description}
          validation={validation}
          {...props}
        />
      );
    },
    defaultValue() {
      return null;
    },
    parse(value) {
      if (value === undefined) return null;
      if (typeof value !== 'string') {
        throw new FieldDataError('Must be a string');
      }
      return value;
    },
    serialize(value) {
      return { value: value === null ? undefined : value };
    },
    validate(value) {
      assertRequired(value, validation, label);
      return value;
    },
  });
}
