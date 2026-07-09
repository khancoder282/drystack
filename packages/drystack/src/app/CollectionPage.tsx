import { useLocalizedStringFormatter } from '@react-aria/i18n';
import { isHotkey } from 'is-hotkey';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ActionButton, Button } from '@keystar/ui/button';
import { DialogContainer } from '@keystar/ui/dialog';
import { Icon } from '@keystar/ui/icon';
import { alertCircleIcon } from '@keystar/ui/icon/icons/alertCircleIcon';
import { listXIcon } from '@keystar/ui/icon/icons/listXIcon';
import { searchIcon } from '@keystar/ui/icon/icons/searchIcon';
import { searchXIcon } from '@keystar/ui/icon/icons/searchXIcon';
import { diffIcon } from '@keystar/ui/icon/icons/diffIcon';
import { plusSquareIcon } from '@keystar/ui/icon/icons/plusSquareIcon';
import { dotSquareIcon } from '@keystar/ui/icon/icons/dotSquareIcon';
import { Flex } from '@keystar/ui/layout';
import { TextLink } from '@keystar/ui/link';
import { ProgressCircle } from '@keystar/ui/progress';
import { SearchField } from '@keystar/ui/search-field';
import {
  breakpointQueries,
  css,
  tokenSchema,
  useMediaQuery,
} from '@keystar/ui/style';
import {
  TableView,
  TableBody,
  TableHeader,
  Column,
  Cell,
  Row,
  SortDescriptor,
} from '@keystar/ui/table';
import { Heading, Text } from '@keystar/ui/typography';

import { Config } from '../config';
import { sortBy } from './collection-sort';
import { renderColumnCell } from './collection-table/cells';
import {
  ColumnDescriptor,
  columnValueToSearchText,
  getDisplayKind,
  redistributeColumnWidths,
} from './collection-table/column-model';
import { ColumnsMenu } from './collection-table/ColumnsMenu';
import {
  PendingCheckboxEdit,
  QuickEditCheckboxDialog,
} from './collection-table/QuickEditCheckboxDialog';
import { useCollectionViewState } from './collection-table/useCollectionViewState';
import l10nMessages from './l10n';
import { useRouter } from './router';
import { EmptyState } from './shell/empty-state';
import {
  useTree,
  TreeData,
  useBaseCommit,
  useCurrentBranch,
  useRepoInfo,
} from './shell/data';
import { PageRoot, PageHeader } from './shell/page';
import {
  getCollectionFormat,
  getCollectionItemPath,
  getCollectionPath,
  getEntriesInCollectionWithTreeKey,
  getEntryDataFilepath,
  getSlugGlobForCollection,
  isLocalConfig,
} from './utils';
import { notFound } from './not-found';
import { fetchBlob } from './useItemData';
import { loadDataFile } from './required-files';
import { parseProps } from '../form/parse-props';
import { useData } from './useData';

type CollectionPageProps = {
  collection: string;
  config: Config;
  basePath: string;
};

export function CollectionPage(props: CollectionPageProps) {
  const { collection, config } = props;
  const containerWidth = 'none'; // TODO: use a "large" when we have more columns
  const collectionConfig = config.collections?.[collection];
  if (!collectionConfig) notFound();

  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(
    new URLSearchParams(router.search).get('search') ?? ''
  );

  const setSearchTermFromForm = useCallback(
    (value: string) => {
      setSearchTerm(value);
      const params = new URLSearchParams(router.search);
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      router.replace(router.pathname + '?' + params.toString());
    },
    [router]
  );

  let debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // every schema field becomes a column automatically — the designated slug
  // field always comes first and is rendered as the "Name" column (see
  // getDisplayKind in collection-table/column-model.ts)
  const columnDescriptors = useMemo<ColumnDescriptor[]>(() => {
    const nameKey = collectionConfig.slugField;
    const keys = [
      nameKey,
      ...Object.keys(collectionConfig.schema).filter(key => key !== nameKey),
    ];
    return keys.map(key => {
      const schema = collectionConfig.schema[key];
      const label = ('label' in schema && schema.label) || key;
      return {
        key,
        label,
        displayKind: getDisplayKind(schema, key, nameKey),
        schema,
      };
    });
  }, [collectionConfig]);

  // image/content fields tend to be heavy (media previews, long text) and
  // clutter the table, so they start out hidden until the user opts in
  const defaultHiddenColumns = useMemo(
    () =>
      columnDescriptors
        .filter(c => c.displayKind === 'image' || c.displayKind === 'content')
        .map(c => c.key),
    [columnDescriptors]
  );

  const {
    hiddenColumns,
    columnWidths,
    setColumnWidths,
    setHiddenColumnsAndWidths,
  } = useCollectionViewState(collection, defaultHiddenColumns);

  const visibleColumnDescriptors = useMemo(
    () =>
      columnDescriptors.filter(
        c => c.displayKind === 'name' || !hiddenColumns.has(c.key)
      ),
    [columnDescriptors, hiddenColumns]
  );

  const handleHiddenColumnsChange = useCallback(
    (hidden: ReadonlySet<string> | string[]) => {
      const hiddenSet = new Set(hidden);
      const visibleKeys = columnDescriptors
        .filter(c => c.displayKind === 'name' || !hiddenSet.has(c.key))
        .map(c => c.key);
      setHiddenColumnsAndWidths(
        hiddenSet,
        redistributeColumnWidths(columnWidths, visibleKeys)
      );
    },
    [columnDescriptors, columnWidths, setHiddenColumnsAndWidths]
  );

  return (
    <PageRoot containerWidth={containerWidth}>
      <CollectionPageHeader
        collectionLabel={collectionConfig.label}
        createHref={`${props.basePath}/collection/${encodeURIComponent(
          props.collection
        )}/create`}
      />
      <CollectionToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTermFromForm}
        columns={columnDescriptors}
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={handleHiddenColumnsChange}
      />
      <CollectionPageContent
        searchTerm={debouncedSearchTerm}
        columnDescriptors={visibleColumnDescriptors}
        columnWidths={columnWidths}
        onColumnWidthsChange={setColumnWidths}
        {...props}
      />
    </PageRoot>
  );
}

function CollectionPageHeader(props: {
  createHref: string;
  collectionLabel: string;
}) {
  const { collectionLabel, createHref } = props;
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);

  return (
    <PageHeader>
      <Heading elementType="h1" id="page-title" size="small" flex minWidth={0}>
        {collectionLabel}
      </Heading>
      <Button marginStart="auto" prominence="high" href={createHref}>
        {stringFormatter.format('add')}
      </Button>
    </PageHeader>
  );
}

function CollectionToolbar(props: {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  columns: ColumnDescriptor[];
  hiddenColumns: ReadonlySet<string>;
  onHiddenColumnsChange: (hidden: Set<string>) => void;
}) {
  const stringFormatter = useLocalizedStringFormatter(l10nMessages);
  const isAboveMobile = useMediaQuery(breakpointQueries.above.mobile);
  const [searchVisible, setSearchVisible] = useState(isAboveMobile);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchVisible(isAboveMobile);
  }, [isAboveMobile]);

  // entries are presented in a virtualized table view, so we replace the
  // default (e.g. ctrl+f) browser search behaviour
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      // bail if the search field is already focused; let users invoke the
      // browser search if they need to
      if (document.activeElement === searchRef.current) {
        return;
      }

      if (isHotkey('mod+f', event)) {
        event.preventDefault();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <Flex
      alignItems="center"
      gap="regular"
      paddingTop={{ tablet: 'large' }}
      UNSAFE_className={css({
        marginInline: tokenSchema.size.space.regular,
        [breakpointQueries.above.mobile]: {
          marginInline: `calc(${tokenSchema.size.space.xlarge} - ${tokenSchema.size.space.medium})`,
        },
        [breakpointQueries.above.tablet]: {
          marginInline: `calc(${tokenSchema.size.space.xxlarge} - ${tokenSchema.size.space.medium})`,
        },
      })}
    >
      <div
        role="search"
        style={{
          display: searchVisible ? 'block' : 'none',
        }}
      >
        <SearchField
          ref={searchRef}
          aria-label={stringFormatter.format('search')} // TODO: l10n "Search {collection}"?
          onChange={props.onSearchTermChange}
          onClear={() => {
            props.onSearchTermChange('');
            if (!isAboveMobile) {
              setTimeout(() => {
                setSearchVisible(false);
              }, 250);
            }
          }}
          onBlur={() => {
            if (!isAboveMobile && props.searchTerm === '') {
              setSearchVisible(false);
            }
          }}
          placeholder={stringFormatter.format('search')}
          value={props.searchTerm}
          width="scale.2400"
        />
      </div>
      <ActionButton
        aria-label="show search"
        isHidden={searchVisible || { above: 'mobile' }}
        onPress={() => {
          setSearchVisible(true);
          // NOTE: this hack is to force the search field to focus, and invoke
          // the software keyboard on mobile safari
          let tempInput = document.createElement('input');
          tempInput.style.position = 'absolute';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          tempInput.focus();

          setTimeout(() => {
            searchRef.current?.focus();
            tempInput.remove();
          }, 0);
        }}
      >
        <Icon src={searchIcon} />
      </ActionButton>
      <ColumnsMenu
        columns={props.columns}
        hiddenColumns={props.hiddenColumns}
        onHiddenColumnsChange={props.onHiddenColumnsChange}
      />
    </Flex>
  );
}

type CollectionPageContentProps = CollectionPageProps & {
  searchTerm: string;
  columnDescriptors: ColumnDescriptor[];
  columnWidths: Record<string, string> | undefined;
  onColumnWidthsChange: (widths: Record<string, string>) => void;
};
function CollectionPageContent(props: CollectionPageContentProps) {
  const trees = useTree();

  const tree =
    trees.merged.kind === 'loaded'
      ? trees.merged.data.current.entries.get(
          getCollectionPath(props.config, props.collection)
        )
      : null;

  if (trees.merged.kind === 'error') {
    return (
      <EmptyState
        icon={alertCircleIcon}
        title="Unable to load collection"
        message={trees.merged.error.message}
        actions={
          <Button tone="accent" href={props.basePath}>
            Dashboard
          </Button>
        }
      />
    );
  }

  if (trees.merged.kind === 'loading') {
    return (
      <EmptyState>
        <ProgressCircle
          aria-label="Loading Entries"
          isIndeterminate
          size="large"
        />
      </EmptyState>
    );
  }

  if (!tree) {
    return (
      <EmptyState
        icon={listXIcon}
        title="Empty collection"
        message={
          <>
            There aren't any entries yet.{' '}
            <TextLink
              href={`${props.basePath}/collection/${encodeURIComponent(
                props.collection
              )}/create`}
            >
              Create the first entry
            </TextLink>{' '}
            to see it here.
          </>
        }
      />
    );
  }

  return <CollectionTable {...props} trees={trees.merged.data} />;
}

const STATUS = '@@status';

function CollectionTable(
  props: CollectionPageContentProps & {
    trees: {
      default: TreeData;
      current: TreeData;
    };
  }
) {
  let { searchTerm, columnDescriptors } = props;

  const repoInfo = useRepoInfo();
  const currentBranch = useCurrentBranch();
  let isLocalMode = isLocalConfig(props.config);
  let router = useRouter();
  const collection = props.config.collections![props.collection]!;
  let [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: collection.slugField,
    direction: 'ascending',
  });
  let hideStatusColumn =
    isLocalMode || currentBranch === repoInfo?.defaultBranch;

  const baseCommit = useBaseCommit();

  const [pendingCheckboxEdit, setPendingCheckboxEdit] =
    useState<PendingCheckboxEdit | null>(null);

  const entriesWithStatus = useMemo(() => {
    const defaultEntries = new Map(
      getEntriesInCollectionWithTreeKey(
        props.config,
        props.collection,
        props.trees.default.tree
      ).map(x => [x.slug, x.key])
    );
    return getEntriesInCollectionWithTreeKey(
      props.config,
      props.collection,
      props.trees.current.tree
    ).map(entry => {
      return {
        name: entry.slug,
        status: defaultEntries.has(entry.slug)
          ? defaultEntries.get(entry.slug) === entry.key
            ? 'Unchanged'
            : 'Changed'
          : 'Added',
        sha: entry.sha,
      };
    });
  }, [props.collection, props.config, props.trees]);

  const mainFiles = useData(
    useCallback(async () => {
      const formatInfo = getCollectionFormat(props.config, props.collection);
      const entries = await Promise.all(
        entriesWithStatus.map(async entry => {
          return [
            entry.name,
            await fetchBlob(
              props.config,
              entry.sha,
              getEntryDataFilepath(
                getCollectionItemPath(
                  props.config,
                  props.collection,
                  entry.name
                ),
                formatInfo
              ),
              baseCommit,
              repoInfo,
              router.basePath
            ),
          ] as const;
        })
      );
      const glob = getSlugGlobForCollection(props.config, props.collection);
      const rootSchema = { kind: 'object' as const, fields: collection.schema };
      const parsedEntries = new Map<string, Record<string, unknown>>();
      for (const [slug, dataFile] of entries) {
        try {
          const { loaded } = loadDataFile(dataFile, formatInfo);
          const validated = parseProps(
            rootSchema,
            loaded,
            [],
            [],
            (schema, value, path) => {
              if (schema.formKind === 'asset' || schema.formKind === 'assets') {
                // cheap: fields.content()'s reader just returns the raw
                // markdown string, no document parsing — see content/index.tsx
                return schema.reader.parse(value);
              }
              if (schema.formKind === 'content') {
                // deprecated markdoc field; needs asset bytes we don't fetch
                // for the table listing
                return;
              }
              if (path.length === 1 && slug !== undefined) {
                if (path[0] === collection.slugField) {
                  if (schema.formKind !== 'slug') {
                    throw new Error(
                      `Slug field ${collection.slugField} is not a slug field`
                    );
                  }
                  return schema.reader.parseWithSlug(value, {
                    slug,
                    glob,
                  });
                }
              }
              return schema.reader.parse(value);
            },
            true
          );
          parsedEntries.set(slug, validated as Record<string, unknown>);
        } catch {}
      }
      return parsedEntries;
    }, [
      collection,
      props.config,
      props.collection,
      entriesWithStatus,
      baseCommit,
      repoInfo,
      router.basePath,
    ])
  );

  const entriesWithData = useMemo((): {
    name: string;
    status: string;
    sha: string;
    data?: Record<string, unknown>;
  }[] => {
    if (mainFiles.kind !== 'loaded' || !mainFiles.data) {
      return entriesWithStatus;
    }
    const { data } = mainFiles;
    return entriesWithStatus.map(entry => {
      return {
        ...entry,
        data: data.get(entry.name),
      };
    });
  }, [entriesWithStatus, mainFiles]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return entriesWithData;
    return entriesWithData.filter(item => {
      const row = item.data ?? {};
      const haystack = columnDescriptors
        .map(descriptor =>
          columnValueToSearchText(descriptor, row[descriptor.key], item.name)
        )
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [entriesWithData, searchTerm, columnDescriptors]);
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const readCol = (
        row: typeof a,
        other: Record<string, unknown> | undefined
      ) => {
        if (sortDescriptor.column === STATUS) {
          return row.status;
        }
        if (sortDescriptor.column === collection.slugField) {
          return collection.parseSlugForSort?.(row.name) ?? row.name;
        }
        return other?.[sortDescriptor.column!] ?? row.name;
      };
      const other = mainFiles.kind === 'loaded' ? mainFiles.data : undefined;
      return sortBy(
        sortDescriptor.direction!,
        readCol(a, other?.get(a.name)),
        readCol(b, other?.get(b.name))
      );
    });
  }, [
    collection,
    filteredItems,
    mainFiles,
    sortDescriptor.column,
    sortDescriptor.direction,
  ]);

  const columns = useMemo(() => {
    return [
      ...(hideStatusColumn
        ? []
        : [{ name: 'Status', key: STATUS, minWidth: 32, width: 32 }]),
      ...columnDescriptors.map(c => ({
        name: c.label,
        key: c.key,
        // `defaultWidth` (not `width`) keeps these columns uncontrolled from
        // react-stately's perspective — react-stately's TableColumnLayout
        // only tracks live drag state for uncontrolled columns; a controlled
        // `width` freezes the column at that prop value during resize since
        // we only feed the result back on resize end, not on every move, so
        // dragging any already-resized column wouldn't visibly move at all
        defaultWidth: props.columnWidths?.[c.key],
        allowsResizing: true,
      })),
    ];
  }, [columnDescriptors, hideStatusColumn, props.columnWidths]);

  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // `onResizeEnd`'s width map only reliably reports the columns directly
  // involved in the drag, not every column — so instead of trusting its
  // values we measure the actual rendered header widths and derive
  // percentages of the whole table from those
  const commitColumnWidthsFromDom = useCallback(() => {
    const container = tableWrapperRef.current;
    if (!container) return;
    const headers = Array.from(
      container.querySelectorAll<HTMLElement>('[role="columnheader"]')
    );
    let total = 0;
    const measured: { key: string; px: number }[] = [];
    headers.forEach((el, i) => {
      const col = columns[i];
      if (!col || col.key === STATUS) return;
      const px = el.getBoundingClientRect().width;
      measured.push({ key: String(col.key), px });
      total += px;
    });
    if (total <= 0) return;
    const next: Record<string, string> = {};
    for (const { key, px } of measured) {
      // the table's width parser only accepts whole-number percentages
      // (e.g. "24%") — a decimal like "24.50%" is silently rejected and
      // falls back to an equal-fr layout for every column
      next[key] = `${Math.round((px / total) * 100)}%`;
    }
    props.onColumnWidthsChange(next);
  }, [columns, props]);

  return (
    <>
      <div ref={tableWrapperRef} className={css({ display: 'contents' })}>
      <TableView
        aria-labelledby="page-title"
        selectionMode="none"
        onSortChange={setSortDescriptor}
        sortDescriptor={sortDescriptor}
        density="spacious"
        overflowMode="wrap"
        prominence="low"
        onResizeEnd={commitColumnWidthsFromDom}
        onAction={key => {
          router.push(
            getItemPath(
              props.basePath,
              props.collection,
              key.toString().slice('key:'.length)
            )
          );
        }}
        renderEmptyState={() => (
          <EmptyState
            icon={searchXIcon}
            title="No results"
            message={`No items matching "${searchTerm}" were found.`}
          />
        )}
        flex
        marginTop={{ tablet: 'large' }}
        marginBottom={{ mobile: 'regular', tablet: 'xlarge' }}
        UNSAFE_className={css({
          marginInline: tokenSchema.size.space.regular,
          [breakpointQueries.above.mobile]: {
            marginInline: `calc(${tokenSchema.size.space.xlarge} - ${tokenSchema.size.space.medium})`,
          },
          [breakpointQueries.above.tablet]: {
            marginInline: `calc(${tokenSchema.size.space.xxlarge} - ${tokenSchema.size.space.medium})`,
          },

          '[role=rowheader]': {
            cursor: 'pointer',
          },
          '[role=gridcell], [role=rowheader]': {
            display: 'flex',
            alignItems: 'center',
          },
        })}
      >
        <TableHeader columns={columns}>
          {({ name, key, ...options }) =>
            key === STATUS ? (
              <Column key={key} isRowHeader allowsSorting {...options}>
                <Icon aria-label="Status" src={diffIcon} />
              </Column>
            ) : (
              <Column key={key} isRowHeader allowsSorting {...options}>
                {name}
              </Column>
            )
          }
        </TableHeader>
        <TableBody items={sortedItems}>
          {item => {
            const statusCell = (
              <Cell key={STATUS + item.name} textValue={item.status}>
                {item.status === 'Added' ? (
                  <Icon color="positive" src={plusSquareIcon} />
                ) : item.status === 'Changed' ? (
                  <Icon color="accent" src={dotSquareIcon} />
                ) : null}
              </Cell>
            );
            const row = item.data ?? {};
            return (
              <Row key={'key:' + item.name}>
                {[
                  ...(hideStatusColumn ? [] : [statusCell]),
                  ...columnDescriptors.map(descriptor => {
                    const value = row[descriptor.key];
                    return (
                      <Cell
                        key={descriptor.key + item.name}
                        textValue={cellTextValue(descriptor, value, item.name)}
                      >
                        {renderColumnCell(descriptor, value, item.name, {
                          onRequestCheckboxEdit: setPendingCheckboxEdit,
                        })}
                      </Cell>
                    );
                  }),
                ]}
              </Row>
            );
          }}
        </TableBody>
      </TableView>
      </div>
      <DialogContainer onDismiss={() => setPendingCheckboxEdit(null)}>
        {pendingCheckboxEdit && (
          <QuickEditCheckboxDialog
            config={props.config}
            collectionKey={props.collection}
            schema={collection.schema}
            slugField={collection.slugField}
            edit={pendingCheckboxEdit}
            onDone={() => setPendingCheckboxEdit(null)}
          />
        )}
      </DialogContainer>
    </>
  );
}

function cellTextValue(
  descriptor: ColumnDescriptor,
  value: unknown,
  itemSlug: string
): string {
  if (descriptor.displayKind === 'name') {
    return typeof value === 'string' && value ? value : itemSlug;
  }
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  return '';
}

function getItemPath(
  basePath: string,
  collection: string,
  key: string | number
): string {
  return `${basePath}/collection/${encodeURIComponent(
    collection
  )}/item/${encodeURIComponent(key)}`;
}
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
