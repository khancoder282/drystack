import { Flex } from '@keystar/ui/layout';
import { Text } from '@keystar/ui/typography';
import { AssetCard, AssetCardProps } from './AssetCard';

export type AssetGridItem = AssetCardProps & { key: string };

export function AssetGrid(props: {
  items: AssetGridItem[];
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '1rem',
        width: '100%',
      }}
    >
      {props.items.map(({ key, ...item }) => (
        <AssetCard key={key} {...item} />
      ))}
    </div>
  );
}
