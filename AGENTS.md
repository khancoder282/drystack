## Configuration

The Keystatic-based CMS config file is `drystack.config.ts` at the project root (this fork renames it from upstream's `keystatic.config.ts`). The Astro integration (`packages/astro/src/index.ts`) resolves the `virtual:keystatic-config` module to this filename and lists it in Vite's `optimizeDeps.entries` — if renamed again, update both spots plus any direct imports (e.g. `src/pages/index.astro`).

## Media library

Uploads via `openMediaLibrary()` / `useMediaLibraryUpload` (`packages/drystack/src/app/media-library/`) write files to disk immediately but intentionally do **not** update the global tree state — see the comment in `useMediaLibraryUpload.ts`. This avoids resetting unsaved form edits, but it means tree-based lookups (`useMediaLibraryPreviewURL`, which resolves a blob sha from the tree) can't find a just-uploaded file until the tree naturally refreshes (e.g. after Save). Any UI that needs to preview a freshly picked/uploaded file should cache the bytes returned in `MediaLibraryPick.content` locally instead of relying solely on the tree lookup.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
