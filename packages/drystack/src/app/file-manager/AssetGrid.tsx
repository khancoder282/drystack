import { AssetCard, AssetCardProps } from './AssetCard';
import { EmptyState } from './EmptyState';

export type AssetGridItem = AssetCardProps & { key: string };

export function AssetGrid(props: {
  items: AssetGridItem[];
  emptyMessage?: string;
}) {
  if (props.items.length === 0) {
    return <EmptyState message={props.emptyMessage ?? 'Nothing here yet.'} />;
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
