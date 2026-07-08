import { ButtonGroup, ActionButton, Button } from '@keystar/ui/button';
import { FieldDescription, FieldLabel, FieldMessage } from '@keystar/ui/field';
import { Flex } from '@keystar/ui/layout';

import { useId, useReducer } from 'react';
import { FormFieldInputProps } from '../../api';
import { openMediaLibrary } from '../../../app/media-library/bridge';
import { useMediaLibraryPreviewURL } from '../../../app/media-library/useMediaLibraryPreviewURL';

// TODO: button labels ("Choose from library", "Remove", "Download") need i18n support
export function FileFieldInput(
  props: FormFieldInputProps<string | null> & {
    label: string;
    description: string | undefined;
    validation: { isRequired?: boolean } | undefined;
  }
) {
  const { value } = props;
  const [blurred, onBlur] = useReducer(() => true, false);
  const objectUrl = useMediaLibraryPreviewURL(value);
  const labelId = useId();
  const descriptionId = useId();
  return (
    <Flex
      aria-describedby={props.description ? descriptionId : undefined}
      aria-labelledby={labelId}
      direction="column"
      gap="medium"
      role="group"
    >
      <FieldLabel
        id={labelId}
        elementType="span"
        isRequired={props.validation?.isRequired}
      >
        {props.label}
      </FieldLabel>
      {props.description && (
        <FieldDescription id={descriptionId}>
          {props.description}
        </FieldDescription>
      )}
      <ButtonGroup>
        <ActionButton
          onPress={async () => {
            const picked = await openMediaLibrary({ accept: 'any' });
            onBlur();
            if (picked) {
              props.onChange(picked.path);
            }
          }}
        >
          Choose from library
        </ActionButton>
        {value !== null && (
          <>
            <ActionButton
              prominence="low"
              onPress={() => {
                props.onChange(null);
                onBlur();
              }}
            >
              Remove
            </ActionButton>
            {objectUrl && (
              <Button
                href={objectUrl}
                download={value.split('/').pop()}
                prominence="low"
              >
                Download
              </Button>
            )}
          </>
        )}
      </ButtonGroup>
      {(props.forceValidation || blurred) &&
        props.validation?.isRequired &&
        value === null && (
          <FieldMessage>{props.label} is required</FieldMessage>
        )}
    </Flex>
  );
}
