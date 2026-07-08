import { ColorScheme } from '@keystar/ui/types';
import { ReactElement, ReactNode } from 'react';

import { ComponentSchema, SlugFormField } from './form/api';
import type { Locale } from './app/l10n/locales';
import { RepoConfig } from './app/repo-config';

// the value a schema field resolves to when read back out of a saved entry
// (i.e. what shows up in a collection table row) — the designated slug field
// reads through `reader.parseWithSlug` instead of `reader.parse`, so it needs
// to be singled out by key rather than just checking `formKind === 'slug'`
type ColumnFieldValue<
  Schema extends Record<string, ComponentSchema>,
  SlugField extends string,
  Key extends keyof Schema,
> = Key extends SlugField
  ? Schema[Key] extends SlugFormField<any, any, any, infer AsSlugValue>
    ? AsSlugValue
    : unknown
  : Schema[Key] extends { reader: { parse(...args: any[]): infer Value } }
    ? Value
    : unknown;

type ColumnRow<
  Schema extends Record<string, ComponentSchema>,
  SlugField extends string,
> = { [Key in keyof Schema]: ColumnFieldValue<Schema, SlugField, Key> };

// method-shorthand indirection so the renderer's parameters are checked
// bivariantly (like every other field callback in this file, e.g.
// FormField['Input']) instead of contravariantly — otherwise a concrete
// `Collection<Schema, SlugField>` (with a narrower `value` type per column)
// can't be assigned back into `Collection<Record<string, ComponentSchema>,
// string>`, which is what `config()`/`collection()` do to type-check entries
type ColumnRenderer<Value, Row> = {
  bivarianceHack(value: Value, row: Row): ReactNode;
}['bivarianceHack'];

// Common
// ----------------------------------------------------------------------------

export type DataFormat = 'json' | 'yaml';
export type Format =
  | DataFormat
  | {
      data?: DataFormat;
      contentField?: string | [string, ...string[]];
    };
export type EntryLayout = 'content' | 'form';
export type Glob = '*' | '**';
export type Collection<
  Schema extends Record<string, ComponentSchema>,
  SlugField extends string,
> = {
  label: string;
  path?: `${string}/${Glob}` | `${string}/${Glob}/${string}`;
  entryLayout?: EntryLayout;
  format?: Format;
  previewUrl?: string;
  // when omitted, the entries table falls back to showing just the slug;
  // when set, the slug column is dropped since a renderer usually already
  // surfaces something more useful (e.g. a title)
  columns?: Partial<{
    [Key in keyof Schema]: ColumnRenderer<
      ColumnFieldValue<Schema, SlugField, Key>,
      ColumnRow<Schema, SlugField>
    >;
  }>;
  template?: string;
  parseSlugForSort?: (slug: string) => string | number;
  slugField: SlugField;
  schema: Schema;
};

export type Singleton<Schema extends Record<string, ComponentSchema>> = {
  label: string;
  path?: string;
  entryLayout?: EntryLayout;
  format?: Format;
  previewUrl?: string;
  schema: Schema;
};

type CommonConfig<Collections, Singletons> = {
  locale?: Locale;
  cloud?: { project: string };
  ui?: UserInterface<Collections, Singletons>;
};

type CommonRemoteStorageConfig = {
  pathPrefix?: string;
  branchPrefix?: string;
};

// Interface
// ----------------------------------------------------------------------------

type BrandMark = (props: {
  colorScheme: Exclude<ColorScheme, 'auto'>; // we resolve "auto" to "light" or "dark" on the client
}) => ReactElement;
export const NAVIGATION_DIVIDER_KEY = '---';
type UserInterface<Collections, Singletons> = {
  brand?: {
    mark?: BrandMark;
    name: string;
  };
  navigation?: Navigation<
    | (keyof Collections & string)
    | (keyof Singletons & string)
    | typeof NAVIGATION_DIVIDER_KEY
  >;
};

type Navigation<K> = K[] | { [section: string]: K[] };

// Storage
// ----------------------------------------------------------------------------

type GitHubStorageConfig = {
  kind: 'github';
  repo: RepoConfig;
} & CommonRemoteStorageConfig;

export type GitHubConfig<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  } = {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  } = {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
> = {
  storage: GitHubStorageConfig;
  collections?: Collections;
  singletons?: Singletons;
} & CommonConfig<Collections, Singletons>;

type LocalStorageConfig = { kind: 'local' };

export type LocalConfig<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  } = {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  } = {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
> = {
  storage: LocalStorageConfig;
  collections?: Collections;
  singletons?: Singletons;
} & CommonConfig<Collections, Singletons>;

type CloudStorageConfig = { kind: 'cloud' } & CommonRemoteStorageConfig;

export type CloudConfig<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  } = {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  } = {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
> = {
  storage: CloudStorageConfig;
  cloud: { project: string };
  collections?: Collections;
  singletons?: Singletons;
} & CommonConfig<Collections, Singletons>;

export type Config<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  } = {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  } = {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
> = {
  storage: LocalStorageConfig | GitHubStorageConfig | CloudStorageConfig;
  collections?: Collections;
  singletons?: Singletons;
} & ({} extends Collections ? {} : { collections: Collections }) &
  ({} extends Singletons ? {} : { singletons: Singletons }) &
  CommonConfig<Collections, Singletons>;

// ============================================================================
// Functions
// ============================================================================

export function config<
  Collections extends {
    [key: string]: Collection<Record<string, ComponentSchema>, string>;
  },
  Singletons extends {
    [key: string]: Singleton<Record<string, ComponentSchema>>;
  },
>(config: Config<Collections, Singletons>) {
  return config;
}

export function collection<
  Schema extends Record<string, ComponentSchema>,
  SlugField extends {
    [K in keyof Schema]: Schema[K] extends SlugFormField<any, any, any, any>
      ? K
      : never;
  }[keyof Schema],
>(
  collection: Collection<Schema, SlugField & string>
): Collection<Schema, SlugField & string> {
  return collection;
}

export function singleton<Schema extends Record<string, ComponentSchema>>(
  collection: Singleton<Schema>
): Singleton<Schema> {
  return collection;
}
