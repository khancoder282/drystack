import { useState } from 'react';
import { Button, ButtonGroup } from '@keystar/ui/button';
import { Checkbox } from '@keystar/ui/checkbox';
import { Dialog } from '@keystar/ui/dialog';
import { Content } from '@keystar/ui/slots';
import { Flex } from '@keystar/ui/layout';
import { Heading, Text } from '@keystar/ui/typography';
import { ConflictResolution, UploadConflictState } from './useFileManagerUpload';

export function UploadConflictDialog(props: {
  state: UploadConflictState;
  onResolve: (resolution: ConflictResolution, applyToAllRemaining: boolean) => void;
}) {
  const [applyToAll, setApplyToAll] = useState(false);
  const current = props.state.files[props.state.index];

  return (
    <Dialog size="small">
      <Heading>File already exists</Heading>
      <Content>
        <Flex direction="column" gap="large">
          <Text>
            <strong>{current.targetPath}</strong> already exists. What would
            you like to do?
          </Text>
          {props.state.remainingConflicts > 1 && (
            <Checkbox isSelected={applyToAll} onChange={setApplyToAll}>
              Apply to all {props.state.remainingConflicts} remaining conflicts
            </Checkbox>
          )}
        </Flex>
      </Content>
      <ButtonGroup>
        <Button onPress={() => props.onResolve('skip', applyToAll)}>
          Cancel
        </Button>
        <Button onPress={() => props.onResolve('rename', applyToAll)}>
          Upload as copy
        </Button>
        <Button
          prominence="high"
          tone="critical"
          onPress={() => props.onResolve('replace', applyToAll)}
        >
          Replace
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}
