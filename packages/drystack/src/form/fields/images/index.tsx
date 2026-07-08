import { BasicFormField } from '../../api';
import { FieldDataError } from '../error';
import {
  RequiredValidation,
  assertRequired,
  basicFormFieldWithSimpleReaderParse,
} from '../utils';
import { ImagesFieldInput } from '#field-ui/images';

export function images<IsRequired extends boolean | undefined>({
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
    Input(props) {
      return (
        <ImagesFieldInput
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
        throw new FieldDataError('Must be an array of image paths');
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
