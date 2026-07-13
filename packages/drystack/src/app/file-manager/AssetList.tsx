import { Flex } from '@keystar/ui/layout';
import { AssetListItem, AssetListItemProps } from './AssetListItem';
import { EmptyState } from './EmptyState';

export type AssetListItemData = AssetListItemProps & { key: string };

export function AssetList(props: {
  items: AssetListItemData[];
  emptyMessage?: string;
}) {
  if (props.items.length === 0) {
    return <EmptyState message={props.emptyMessage ?? 'Nothing here yet.'} />;
  }
  return (
    <Flex direction="column" gap="medium">
      {props.items.map(({ key, ...item }) => (
        <AssetListItem key={key} {...item} />
      ))}
    </Flex>
  );
}
