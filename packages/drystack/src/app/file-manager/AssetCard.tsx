import { ActionButton } from '@keystar/ui/button';
import { Checkbox } from '@keystar/ui/checkbox';
import { Icon } from '@keystar/ui/icon';
import { fileCodeIcon } from '@keystar/ui/icon/icons/fileCodeIcon';
import { folderClosedIcon } from '@keystar/ui/icon/icons/folderClosedIcon';
import { imageIcon } from '@keystar/ui/icon/icons/imageIcon';
import { trash2Icon } from '@keystar/ui/icon/icons/trash2Icon';
import { rotateCcwIcon } from '@keystar/ui/icon/icons/rotateCcwIcon';
import { Flex } from '@keystar/ui/layout';
import { Text } from '@keystar/ui/typography';
import { TooltipTrigger, Tooltip } from '@keystar/ui/tooltip';

import { useMediaLibraryPreviewURL } from '../media-library/useMediaLibraryPreviewURL';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export type AssetCardProps = {
  name: string;
  kind: 'folder' | 'file';
  // real tree path — only required when selectable/deletable
  path?: string;
  isImage?: boolean;
  childCount?: number;
  size?: number | null;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onOpen: () => void;
  // shown dimmed and non-interactive — used for files excluded by a picker's
  // `accept` filter, which the plan wants visible-but-unselectable rather
  // than hidden entirely
  disabled?: boolean;
};

export function AssetCard(props: AssetCardProps) {
  const previewUrl = useMediaLibraryPreviewURL(
    props.kind === 'file' && props.isImage && props.path ? props.path : null
  );

  return (
    <Flex
      direction="column"
      gap="small"
      UNSAFE_style={{
        width: 150,
        position: 'relative',
        opacity: props.disabled ? 0.45 : undefined,
      }}
    >
      {!props.disabled && (props.onDelete || props.onRestore) && (
        <Flex
          gap="small"
          UNSAFE_style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
        >
          {props.onRestore && (
            <TooltipTrigger>
              <ActionButton
                prominence="low"
                aria-label="Restore"
                onPress={props.onRestore}
              >
                <Icon src={rotateCcwIcon} />
              </ActionButton>
              <Tooltip>Restore</Tooltip>
            </TooltipTrigger>
          )}
          {props.onDelete && (
            <TooltipTrigger>
              <ActionButton
                prominence="low"
                aria-label="Delete"
                onPress={props.onDelete}
              >
                <Icon src={trash2Icon} />
              </ActionButton>
              <Tooltip tone="critical">Delete</Tooltip>
            </TooltipTrigger>
          )}
        </Flex>
      )}
      <ActionButton
        aria-label={
          props.kind === 'folder' ? `Open ${props.name}` : `Preview ${props.name}`
        }
        UNSAFE_style={{ height: 'unset', padding: 0 }}
        isDisabled={props.disabled}
        onPress={props.onOpen}
      >
        <Flex
          alignItems="center"
          justifyContent="center"
          backgroundColor="canvas"
          border="neutral"
          borderRadius="regular"
          UNSAFE_style={{ width: '100%', height: 110, overflow: 'hidden' }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              style={{
                display: 'block',
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Icon
              src={
                props.kind === 'folder'
                  ? folderClosedIcon
                  : props.isImage
                    ? imageIcon
                    : fileCodeIcon
              }
              size="large"
            />
          )}
        </Flex>
      </ActionButton>
      <Flex gap="small" alignItems="center">
        {!props.disabled && props.selectable && (
          <Checkbox
            aria-label={`Select ${props.name}`}
            isSelected={props.isSelected}
            onChange={props.onToggleSelect}
          />
        )}
        <Flex direction="column" UNSAFE_style={{ minWidth: 0, flex: 1 }}>
          <Text
            size="small"
            UNSAFE_style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {props.name}
          </Text>
          <Text size="small" color="neutralTertiary" UNSAFE_style={{ opacity: 0.7 }}>
            {props.kind === 'folder'
              ? `${props.childCount ?? 0} item${props.childCount === 1 ? '' : 's'}`
              : props.size != null
                ? formatBytes(props.size)
                : '—'}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
}
