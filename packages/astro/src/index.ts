import type { AstroIntegration } from 'astro';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RunnableDevEnvironment, ViteDevServer } from 'vite';
import { createRunnableDevEnvironment } from 'vite';
import { mkdirSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

// A dedicated Node-runnable Vite environment for the local-storage API. The
// Cloudflare adapter turns the default `ssr` environment into a non-runnable
// workerd one, so we can't use `server.ssrLoadModule` to run the handler in
// Node. This separate environment loads/executes drystack's API modules in the
// real Node process, where `fs` writes actually work.
const DRYSTACK_NODE_ENV = 'drystack_local_api';

const virtualPathModuleId = 'virtual:drystack-path';
const resolvedVirtualPathModuleId = '\0' + virtualPathModuleId;

const virtualBuildVersionModuleId = 'virtual:drystack-build-version';
const resolvedVirtualBuildVersionModuleId = '\0' + virtualBuildVersionModuleId;

// Runs the drystack API handler in the Node dev process (not workerd), so
// `storage: 'local'` filesystem writes work under `astro dev`. Loaded lazily
// via Vite's `ssrLoadModule` so it executes in Node with real `fs`. Only local
// storage is handled here; other modes are passed through to the normal route.
async function handleLocalApiRequest(
  server: ViteDevServer,
  basePath: string,
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void
): Promise<void> {
  const env = server.environments[DRYSTACK_NODE_ENV] as
    | RunnableDevEnvironment
    | undefined;
  if (!env?.runner) {
    // Environment wasn't set up (shouldn't happen in dev) — let the route try.
    return next();
  }
  const [genericMod, configMod] = await Promise.all([
    env.runner.import('@drystack/core/api/generic'),
    env.runner.import('virtual:drystack-config'),
  ]);
  const config = configMod.default;
  if (config?.storage?.kind !== 'local') {
    // Let the workerd-run route handle GitHub mode.
    return next();
  }

  const handler = genericMod.makeGenericAPIRouteHandler(
    { config, basePath },
    { slugEnvName: 'PUBLIC_DRYSTACK_GITHUB_APP_SLUG' }
  );

  const host = req.headers.host ?? 'localhost';
  const method = req.method ?? 'GET';
  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach(v => requestHeaders.append(key, v));
    else if (value != null) requestHeaders.set(key, value);
  }

  let body: Buffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    body = Buffer.concat(chunks);
  }

  const request = new Request(`http://${host}${req.url ?? ''}`, {
    method,
    headers: requestHeaders,
    body,
  });

  const response = await handler(request);

  res.statusCode = response.status;
  const responseHeaders = response.headers;
  if (responseHeaders) {
    const setHeader = (k: string, v: string) => res.setHeader(k, v);
    if (Array.isArray(responseHeaders)) {
      for (const [k, v] of responseHeaders) setHeader(k, v);
    } else if (typeof responseHeaders.entries === 'function') {
      for (const [k, v] of (responseHeaders as Headers).entries()) setHeader(k, v);
    } else {
      for (const [k, v] of Object.entries(responseHeaders)) {
        if (v != null) setHeader(k, String(v));
      }
    }
  }

  const responseBody = response.body;
  if (responseBody == null) res.end();
  else if (typeof responseBody === 'string') res.end(responseBody);
  else res.end(Buffer.from(responseBody as Uint8Array));
}

// Top-level project directories that never hold drystack-managed content
// assets, so the asset-copy scan skips them (`src/assets/` in particular is
// Astro's own ESM asset dir handled by `astro:assets`, not the media library).
const ASSET_COPY_EXCLUDE = new Set([
  'node_modules',
  'dist',
  'public',
  'src',
  'packages',
]);

// drystack's media library only ever writes into directories literally named
// `assets` — the shared root `assets/` and each entry's co-located
// `<collection>/<slug>/assets/`. Astro's static build copies `public/` into the
// client output but knows nothing about these dirs, so every CMS-managed image
// 404s once deployed. This mirrors those `assets/` dirs into the client output,
// preserving their repo-relative path, so the `/…/assets/<file>` URLs stored in
// image fields resolve in production. Works for both storage kinds: the files
// are on disk at build time (local mode: the dev disk; github mode: the repo
// checkout Cloudflare builds from). `.deleted` trash dirs are skipped so files
// the user removed via the File Manager don't get republished.
function copyDrystackAssets(root: string, clientDir: string) {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const abs = join(dir, entry.name);
      if (entry.name === 'assets') found.push(abs);
      else walk(abs);
    }
  };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (ASSET_COPY_EXCLUDE.has(entry.name)) continue;
    const abs = join(root, entry.name);
    if (entry.name === 'assets') found.push(abs);
    else walk(abs);
  }
  for (const abs of found) {
    const dest = join(clientDir, relative(root, abs));
    mkdirSync(dest, { recursive: true });
    cpSync(abs, dest, { recursive: true });
  }
}

export default function drystack(options?: { path?: string }): AstroIntegration {
  const path = (options?.path ?? 'drystack').replace(/^\/+|\/+$/g, '');
  // Captured once per build/dev-server start. Cloudflare Pages runs a fresh
  // build on every deploy, so this timestamp is monotonically increasing
  // across deploys — the client compares it against the version it last saw
  // to detect "a newer build was published" and discard stale IndexedDB edits.
  const buildVersion = Date.now();
  // Captured in `astro:config:done` (final resolved paths) and consumed in
  // `astro:build:done` to mirror drystack `assets/` dirs into the client output.
  let projectRoot: string | undefined;
  let clientOutDir: string | undefined;
  return {
    name: 'drystack',
    hooks: {
      'astro:config:done': ({ config }) => {
        projectRoot = fileURLToPath(config.root);
        clientOutDir = fileURLToPath(config.build.client);
      },
      'astro:build:done': () => {
        if (projectRoot && clientOutDir) {
          copyDrystackAssets(projectRoot, clientOutDir);
        }
      },
      'astro:config:setup': ({ injectRoute, injectScript, updateConfig, config }) => {
        updateConfig({
          server: config.server.host ? {} : { host: '127.0.0.1' },
          vite: {
            plugins: [
              {
                name: 'drystack',
                resolveId(id) {
                  if (id === 'virtual:drystack-config') {
                    return this.resolve('./drystack.config', './a');
                  }
                  if (id === virtualPathModuleId) {
                    return resolvedVirtualPathModuleId;
                  }
                  if (id === virtualBuildVersionModuleId) {
                    return resolvedVirtualBuildVersionModuleId;
                  }
                  return null;
                },
                load(id) {
                  if (id === resolvedVirtualPathModuleId) {
                    return `export default ${JSON.stringify(path)};`;
                  }
                  if (id === resolvedVirtualBuildVersionModuleId) {
                    return `export default ${JSON.stringify(buildVersion)};`;
                  }
                  return null;
                },
              },
            ],
            optimizeDeps: {
              entries: ['drystack.config.*', '.astro/drystack-imports.js'],
            },
          },
        });

        const dotAstroDir = new URL('./.astro/', config.root);
        mkdirSync(dotAstroDir, { recursive: true });
        writeFileSync(
          new URL('drystack-imports.js', dotAstroDir),
          `import "@drystack/astro/ui";
import "@drystack/astro/api";
import "@drystack/core/ui";
`
        );

        injectRoute({
          // @ts-ignore — kept for Astro 2/3 where the option was named `entryPoint`
          entryPoint: '@drystack/astro/internal/drystack-astro-page.astro',
          entrypoint: '@drystack/astro/internal/drystack-astro-page.astro',
          pattern: `/${path}/[...params]`,
          prerender: false,
        });
        injectRoute({
          // @ts-ignore — kept for Astro 2/3 where the option was named `entryPoint`
          entryPoint: '@drystack/astro/internal/drystack-api.js',
          entrypoint: '@drystack/astro/internal/drystack-api.js',
          pattern: `/api/${path}/[...params]`,
          prerender: false,
        });

        // Under the Cloudflare adapter, `astro dev` executes on-demand routes
        // inside workerd. workerd's node:fs compat can *read* the host disk but
        // rejects writes (`mkdir` → "operation not permitted"), so the
        // local-storage API (`/api/<path>/update`, and reads for consistency)
        // can't run there. Intercept those requests in a Node-side Vite dev
        // middleware — it runs in the real Node host where fs writes work — and
        // run the exact same handler `drystack-api.js` uses. GitHub-mode
        // requests (OAuth, app creation) fall through to the workerd route.
        updateConfig({
          vite: {
            environments: {
              [DRYSTACK_NODE_ENV]: {
                dev: {
                  // `createRunnableDevEnvironment` gives us a Node module
                  // runner (unlike the workerd `ssr` environment).
                  createEnvironment(name, viteConfig) {
                    return createRunnableDevEnvironment(name, viteConfig);
                  },
                },
                resolve: {
                  // Real Node resolution (not workerd) so `#api-handler` and
                  // node builtins point at the filesystem-capable versions.
                  conditions: ['node', 'import', 'module', 'default'],
                },
              },
            },
            plugins: [
              {
                name: 'drystack:local-api-dev-middleware',
                apply: 'serve',
                configureServer(server) {
                  const apiPrefix = `/api/${path}`;
                  server.middlewares.use((req, res, next) => {
                    const url = req.url ?? '';
                    if (
                      url !== apiPrefix &&
                      !url.startsWith(`${apiPrefix}/`) &&
                      !url.startsWith(`${apiPrefix}?`)
                    ) {
                      return next();
                    }
                    handleLocalApiRequest(server, path, req, res, next).catch(
                      next
                    );
                  });
                },
              },
            ],
          },
        });

        // MVP 1 visual DOM editor — stage 1: tiny eligibility check present on
        // every page (dev, or a logged-in-GitHub cookie in prod). Only when
        // eligible does it dynamically import the real editor (stage 2), so
        // anonymous visitors never download the editor chunk.
        injectScript(
          'page',
          `const eligible = import.meta.env.DEV || document.cookie.includes('drystack-gh-access-token=');
if (eligible) {
  if (import.meta.env.DEV) {
    // The editor is mounted manually (not as an Astro/React island), so
    // @vitejs/plugin-react's Fast Refresh preamble — normally injected into
    // the HTML of pages with a client:* React island — never runs here.
    // Without it, the .tsx modules below (and drystack.config's own field UI
    // components, transitively imported when loading the config) throw
    // "can't detect preamble" as soon as they're evaluated. A static
    // top-level import would be hoisted and evaluated before we get a
    // chance to install the preamble, so every import below is dynamic —
    // dynamic imports run in the exact order awaited, unlike static ones.
    const refresh = await import('/@react-refresh');
    refresh.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
  }
  const [{ default: cfg }, { default: buildVersion }, editor] = await Promise.all([
    import('virtual:drystack-config'),
    import('virtual:drystack-build-version'),
    import('@drystack/astro/editor'),
  ]);
  editor.mount(cfg, buildVersion);
}`
        );
      },
    },
  };
}
