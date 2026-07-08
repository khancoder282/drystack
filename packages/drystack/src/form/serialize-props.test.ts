import { expect, test } from '@jest/globals';
import { ComponentSchema, ParsedValueForComponentSchema, fields } from '..';
import { getInitialPropsValue } from './initial-values';
import { serializeProps as _serializeProps } from './serialize-props';

const serializeProps: <Schema extends ComponentSchema>(
  rootValue: ParsedValueForComponentSchema<Schema>,
  rootSchema: Schema,
  // note you might have a slug without a slug field when serializing props inside a component block or etc. in the editor
  slugField: string | undefined,
  slug: string | undefined,
  shouldSuggestFilenamePrefix: boolean
) => {
  value: unknown;
  extraFiles: {
    path: string;
    parent: string | undefined;
    contents: Uint8Array;
  }[];
} = _serializeProps as any;

test('serialize empty image', () => {
  const schema = fields.object({
    image: fields.image({ label: 'Image' }),
  });
  const initial = getInitialPropsValue(schema);
  expect(initial).toMatchInlineSnapshot(`
    {
      "image": null,
    }
  `);
  expect(serializeProps(initial, schema, undefined, undefined, true))
    .toMatchInlineSnapshot(`
    {
      "extraFiles": [],
      "value": {},
    }
  `);
});

test('serialize image in collection', () => {
  const schema = fields.object({
    slug: fields.text({ label: 'Slug' }),
    image: fields.image({ label: 'Image' }),
  });
  const val: ParsedValueForComponentSchema<typeof schema> = {
    image: '/src/assets/image.png',
    slug: 'my-slug',
  };
  expect(serializeProps(val, schema, 'slug', val.slug, true))
    .toMatchInlineSnapshot(`
    {
      "extraFiles": [],
      "value": {
        "image": "/src/assets/image.png",
      },
    }
  `);
});

test('serialize image in singleton', () => {
  const schema = fields.object({
    image: fields.image({ label: 'Image' }),
  });
  const val: ParsedValueForComponentSchema<typeof schema> = {
    image: '/src/assets/image.png',
  };
  expect(serializeProps(val, schema, undefined, undefined, true))
    .toMatchInlineSnapshot(`
    {
      "extraFiles": [],
      "value": {
        "image": "/src/assets/image.png",
      },
    }
  `);
});
