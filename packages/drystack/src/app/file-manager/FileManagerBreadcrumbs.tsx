import { Key } from 'react';
import { Breadcrumbs, Item } from '@keystar/ui/breadcrumbs';

export type Crumb = { key: string; label: string };

export function FileManagerBreadcrumbs(props: {
  crumbs: Crumb[];
  onNavigate: (key: string) => void;
}) {
  return (
    <Breadcrumbs onAction={(key: Key) => props.onNavigate(String(key))}>
      {props.crumbs.map(c => (
        <Item key={c.key}>{c.label}</Item>
      ))}
    </Breadcrumbs>
  );
}
