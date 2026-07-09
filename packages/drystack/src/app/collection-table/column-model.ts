import { ComponentSchema } from '../../form/api';

// a normalized hint for how a schema field should be presented as a
// collection-table column/cell — folds together the schema-level `formKind`
// discriminant (slug/assets) and the `columnKind` hint basic fields carry
// (see `ColumnKind` in form/api.tsx) into one thing the table can switch on.
export type DisplayKind =
  | 'name' // the collection's designated slug/title field
  | 'checkbox'
  | 'image'
  | 'file'
  | 'url'
  | 'relationship'
  | 'multiRelationship'
  | 'date'
  | 'datetime'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'files'
  | 'content' // fields.content() — rendered as a size/word-count summary
  | 'slugPair' // a non-designated fields.slug()/fields.text() column — the
  // actual shape (string vs {name,slug}) is only known at the value level,
  // see `isNameSlugPair` in cells.tsx
  | 'array'
  | 'object'
  | 'text';

export function getDisplayKind(
  schema: ComponentSchema,
  key: string,
  slugField: string
): DisplayKind {
  if (key === slugField) return 'name';
  if (schema.kind === 'array') return 'array';
  if (schema.kind === 'object') return 'object';
  if (schema.kind !== 'form') return 'text';
  if (schema.formKind === 'assets') return 'content';
  if (schema.formKind === 'slug') return 'slugPair';
  if (schema.formKind === 'content' || schema.formKind === 'asset') {
    return 'text';
  }
  return schema.columnKind ?? 'text';
}

export type ColumnDescriptor = {
  key: string;
  label: string;
  displayKind: DisplayKind;
  schema: ComponentSchema;
};

// rescales saved column-width percentages so the currently visible set sums
// back to 100% — otherwise hiding a column leaves the rest short of the
// table's full width (nothing is left to absorb its share), and re-showing
// one drops it in with no room since the others already claim 100%
export function redistributeColumnWidths(
  columnWidths: Record<string, string> | undefined,
  visibleKeys: string[]
): Record<string, string> {
  if (visibleKeys.length === 0) return { ...columnWidths };
  const parsePercent = (value: string | undefined) => {
    const match = value?.match(/^(\d+)%$/);
    return match ? Number(match[1]) : undefined;
  };
  const equalShare = 100 / visibleKeys.length;
  const weights = visibleKeys.map(
    key => parsePercent(columnWidths?.[key]) ?? equalShare
  );
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const rounded = weights.map(w => Math.round((w / total) * 100));
  // the table's width parser only accepts whole-number percentages, so
  // rounding each share individually can drift the total away from 100 —
  // correct that drift on the last column
  rounded[rounded.length - 1] += 100 - rounded.reduce((sum, w) => sum + w, 0);
  const next = { ...columnWidths };
  visibleKeys.forEach((key, i) => {
    next[key] = `${rounded[i]}%`;
  });
  return next;
}

// text a column's value contributes to the "search across visible columns"
// haystack — deliberately blank for kinds where stringifying the raw value
// wouldn't be meaningful to search (images, checkboxes, nested structures)
export function columnValueToSearchText(
  descriptor: ColumnDescriptor,
  value: unknown,
  itemSlug: string
): string {
  switch (descriptor.displayKind) {
    case 'name':
      return `${typeof value === 'string' ? value : ''} ${itemSlug}`;
    case 'slugPair':
      if (value && typeof value === 'object' && 'name' in value) {
        return String((value as any).name ?? '');
      }
      return typeof value === 'string' ? value : '';
    case 'content':
    case 'url':
    case 'relationship':
    case 'select':
      return typeof value === 'string' ? value : '';
    case 'multiselect':
    case 'multiRelationship':
    case 'files':
      return Array.isArray(value) ? value.join(' ') : '';
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? value : '';
    case 'number':
      return value != null ? String(value) : '';
    case 'text':
      return typeof value === 'string' ? value : '';
    case 'checkbox':
    case 'image':
    case 'file':
    case 'array':
    case 'object':
      return '';
    default:
      return '';
  }
}
