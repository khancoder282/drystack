import { useState } from 'react';
import { Button, ButtonGroup } from '@keystar/ui/button';
import { Dialog } from '@keystar/ui/dialog';
import { Content } from '@keystar/ui/slots';
import { Heading } from '@keystar/ui/typography';
import { TextField } from '@keystar/ui/text-field';

function validateName(name: string, existingNames: ReadonlySet<string>) {
  if (!name) return undefined;
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    return "That's not a valid folder name.";
  }
  if (existingNames.has(name)) {
    return 'A file or folder with this name already exists here.';
  }
  return undefined;
}

export function NewFolderDialog(props: {
  existingNames: ReadonlySet<string>;
  isCreating: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const error = validateName(trimmed, props.existingNames);

  return (
    <Dialog size="small">
      <form
        style={{ display: 'contents' }}
        onSubmit={event => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          if (!trimmed || error) return;
          props.onCreate(trimmed);
        }}
      >
        <Heading>New folder</Heading>
        <Content>
          <TextField
            label="Folder name"
            value={name}
            onChange={setName}
            autoFocus
            errorMessage={error}
          />
        </Content>
        <ButtonGroup>
          <Button onPress={props.onCancel} isDisabled={props.isCreating}>
            Cancel
          </Button>
          <Button
            type="submit"
            prominence="high"
            isDisabled={props.isCreating || !trimmed || !!error}
          >
            Create
          </Button>
        </ButtonGroup>
      </form>
    </Dialog>
  );
}
