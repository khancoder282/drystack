# @drystack/astro

Astro integration for [drystack](https://github.com/khancoder282/drystack) — adds an admin UI route, content API, and live in-page editing toolbar to an Astro site backed by `@drystack/core`.

## Install

```sh
npm install @drystack/astro @drystack/core
```

## Usage

```ts
// astro.config.ts
import { defineConfig } from 'astro/config';
import drystack from '@drystack/astro';

export default defineConfig({
  integrations: [drystack()],
});
```

See the [drystack repository](https://github.com/khancoder282/drystack) for full configuration (`drystack.config.ts`), storage modes (local/GitHub), and deployment notes (Cloudflare Workers).

## License

MIT
