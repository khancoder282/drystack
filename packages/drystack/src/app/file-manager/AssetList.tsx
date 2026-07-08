import { Flex } from '@keystar/ui/layout';
import { Text } from '@keystar/ui/typography';
import { AssetListItem, AssetListItemProps } from './AssetListItem';

export type AssetListItemData = AssetListItemProps & { key: string };

export function AssetList(props: {
  items: AssetListItemData[];
  emptyMessage?: string;
}) {
  if (props.items.length === 0) {
    return (
      <Text color="neutralTertiary">
        {props.emptyMessage ?? 'Nothing here yet.'}
      </Text>
    );
  }
  return (
    <Flex direction="column" gap="medium">
      {props.items.map(({ key, ...item }) => (
        <AssetListItem key={key} {...item} />
      ))}
    </Flex>
  );
}
