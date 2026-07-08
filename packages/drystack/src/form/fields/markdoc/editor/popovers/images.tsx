import { ButtonGroup, Button, ActionButton } from '@keystar/ui/button';
import {
  useDialogContainer,
  Dialog,
  DialogContainer,
} from '@keystar/ui/dialog';
import { Divider, Flex } from '@keystar/ui/layout';
import { Content } from '@keystar/ui/slots';
import { TextField } from '@keystar/ui/text-field';
import { Heading, Text } from '@keystar/ui/typography';
import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { useMemo, useState } from 'react';
import { clientSideValidateProp } from '../../../../errors';
import { FormValueContentFromPreviewProps } from '../../../../form-from-preview';
import { createGetPreviewProps } from '../../../../preview-props';
import l10nMessages from '../../../../../app/l10n';
import { Icon } from '@keystar/ui/icon';
import { alignCenterIcon } from '@keystar/ui/icon/icons/alignCenterIcon';
import { alignLeftIcon } from '@keystar/ui/icon/icons/alignLeftIcon';
import { alignRightIcon } from '@keystar/ui/icon/icons/alignRightIcon';
import { editIcon } from '@keystar/ui/icon/icons/editIcon';
import { fileUpIcon } from '@keystar/ui/icon/icons/fileUpIcon';
import { trash2Icon } from '@keystar/ui/icon/icons/trash2Icon';
import { TooltipTrigger, Tooltip } from '@keystar/ui/tooltip';
import { ToggleButton } from '@keystar/ui/button';
import { openMediaLibrary } from '../../../../../app/media-library/bridge';
import { EditorState, NodeSelection } from 'prosemirror-state';
import { useEditorDispatchCommand, useEditorSchema } from '../editor-view';
import { Node } from 'prosemirror-model';
import { imageAttrsForPick } from '../image-pick';
import { ImageAlign } from '../image-layout';
import { useMediaScope } from '../media-scope';

export function ImagePopover(props: {
  node: Node;
  state: EditorState;
  pos: number;
}) {
  let stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const runCommand = useEditorDispatchCommand();
  const schema = useEditorSchema();
  const mediaScope = useMediaScope();
  const [dialogOpen, setDialogOpen] = useState(false);
  const align: ImageAlign | null = props.node.attrs.align;
  const toggleAlign = (value: ImageAlign) => {
    runCommand((state, dispatch) => {
      if (dispatch) {
        dispatch(
          state.tr.setNodeAttribute(
            props.pos,
            'align',
            align === value ? null : value
          )
        );
      }
      return true;
    });
  };
  return (
    <>
      <Flex gap="regular" padding="regular">
        <Flex gap="small">
          <TooltipTrigger>
            <ToggleButton
              prominence="low"
              isSelected={align === 'left'}
              aria-label="Float left"
              onPress={() => toggleAlign('left')}
            >
              <Icon src={alignLeftIcon} />
            </ToggleButton>
            <Tooltip>Float left</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <ToggleButton
              prominence="low"
              isSelected={align === 'center'}
              aria-label="Center"
              onPress={() => toggleAlign('center')}
            >
              <Icon src={alignCenterIcon} />
            </ToggleButton>
            <Tooltip>Center</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <ToggleButton
              prominence="low"
              isSelected={align === 'right'}
              aria-label="Float right"
              onPress={() => toggleAlign('right')}
            >
              <Icon src={alignRightIcon} />
            </ToggleButton>
            <Tooltip>Float right</Tooltip>
          </TooltipTrigger>
        </Flex>
        <Divider orientation="vertical" />
        <Flex gap="small">
          <TooltipTrigger>
            <ActionButton prominence="low" onPress={() => setDialogOpen(true)}>
              <Icon src={editIcon} />
            </ActionButton>
            <Tooltip>{stringFormatter.format('edit')}</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <ActionButton
              prominence="low"
              onPress={async () => {
                const picked = await openMediaLibrary({
                  accept: 'image',
                  local: mediaScope ?? undefined,
                });
                if (!picked || !schema.config.image) return;
                const { src, filename } = imageAttrsForPick(
                  picked,
                  schema.config.image.transformFilename,
                  schema.config.supportsMediaLibraryReferences
                );
                runCommand((state, dispatch) => {
                  if (dispatch) {
                    const { tr } = state;
                    tr.setNodeAttribute(props.pos, 'src', src);
                    tr.setNodeAttribute(props.pos, 'filename', filename);
                    const newState = state.apply(tr);
                    tr.setSelection(
                      NodeSelection.create(newState.doc, props.pos)
                    );
                    dispatch(tr);
                  }
                  return true;
                });
              }}
            >
              <Icon src={fileUpIcon} />
            </ActionButton>
            <Tooltip>Choose from library</Tooltip>
          </TooltipTrigger>
        </Flex>
        <Divider orientation="vertical" />
        <TooltipTrigger>
          <ActionButton
            prominence="low"
            onPress={() => {
              runCommand((state, dispatch) => {
                if (dispatch) {
                  dispatch(
                    state.tr.delete(props.pos, props.pos + props.node.nodeSize)
                  );
                }
                return true;
              });
            }}
          >
            <Icon src={trash2Icon} />
          </ActionButton>
          <Tooltip tone="critical">Remove</Tooltip>
        </TooltipTrigger>
      </Flex>
      <DialogContainer
        onDismiss={() => {
          setDialogOpen(false);
        }}
      >
        {dialogOpen && (
          <ImageDialog
            alt={props.node.attrs.alt}
            title={props.node.attrs.title}
            filename={props.node.attrs.filename}
            onSubmit={value => {
              runCommand((state, dispatch) => {
                if (dispatch) {
                  const { tr } = state;
                  tr.setNodeMarkup(props.pos, undefined, {
                    ...props.node.attrs,
                    ...value,
                  });
                  const newState = state.apply(tr);
                  tr.setSelection(
                    NodeSelection.create(newState.doc, props.pos)
                  );
                  dispatch(tr);
                }
                return true;
              });
              setDialogOpen(false);
            }}
          />
        )}
      </DialogContainer>
    </>
  );
}

function ImageDialog(props: {
  alt: string;
  title: string;
  filename: string;
  onSubmit: (value: { alt: string; filename: string; title: string }) => void;
}) {
  const schema = useEditorSchema();
  const [state, setState] = useState({ alt: props.alt, title: props.title });
  const imagesSchema = useMemo(
    () => ({ kind: 'object' as const, fields: schema.config.image!.schema }),
    [schema.config.image]
  );
  const previewProps = useMemo(
    () => createGetPreviewProps(imagesSchema, setState, () => undefined),
    [imagesSchema]
  )(state);

  const [filenameWithoutExtension, filenameExtension] = splitFilename(
    props.filename
  );
  const [forceValidation, setForceValidation] = useState(false);
  let [fileName, setFileName] = useState(filenameWithoutExtension);
  let [fileNameTouched, setFileNameTouched] = useState(false);

  let { dismiss } = useDialogContainer();
  let stringFormatter = useLocalizedStringFormatter(l10nMessages);

  return (
    <Dialog size="small">
      <form
        style={{ display: 'contents' }}
        onSubmit={event => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          setForceValidation(true);
          if (
            fileName &&
            clientSideValidateProp(imagesSchema, state, undefined)
          ) {
            dismiss();
            props.onSubmit({
              alt: state.alt,
              title: state.title,
              filename: [fileName, filenameExtension].join('.'),
            });
          }
        }}
      >
        <Heading>Image details</Heading>
        <Content>
          <Flex gap="large" direction="column">
            <TextField
              label="File name"
              onChange={setFileName}
              onBlur={() => setFileNameTouched(true)}
              value={fileName}
              isRequired
              errorMessage={
                (fileNameTouched || forceValidation) && !fileName
                  ? 'Please provide a file name.'
                  : undefined
              }
              endElement={
                filenameExtension ? (
                  <Flex
                    alignItems="center"
                    justifyContent="center"
                    paddingEnd="regular"
                  >
                    <Text color="neutralTertiary">.{filenameExtension}</Text>
                  </Flex>
                ) : null
              }
            />
            <FormValueContentFromPreviewProps
              forceValidation={forceValidation}
              autoFocus
              {...previewProps}
            />
          </Flex>
        </Content>
        <ButtonGroup>
          <Button onPress={dismiss}>{stringFormatter.format('cancel')}</Button>
          <Button prominence="high" type="submit">
            {stringFormatter.format('save')}
          </Button>
        </ButtonGroup>
      </form>
    </Dialog>
  );
}

function splitFilename(filename: string): [string, string] {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) {
    return [filename, ''];
  }
  return [filename.substring(0, dotIndex), filename.substring(dotIndex + 1)];
}
