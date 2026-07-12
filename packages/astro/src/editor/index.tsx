import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { KeystarProvider } from '@keystar/ui/core';
import { Toaster } from '@keystar/ui/toast';
import type { Config } from '@drystack/core';
import { Toolbar } from './Toolbar';
import {
  applyPendingEdits,
  discardEditsIfBuildIsNewer,
  subscribeToRemoteEdits,
} from './bind';
// Raw CSS string (Vite ?inline) — injected into the host page's <head> below.
import editorStyles from './editor.css?inline';

const ROOT_ID = 'drystack-editor-root';

// Mirrors the admin app's theme picker, which persists the choice to
// localStorage under this key as 'auto' | 'light' | 'dark'
// (packages/drystack/src/app/shell/theme.tsx). The editor is a separate React
// tree on a separate (live-site) tab, so reading this key + listening for
// `storage` events keeps its Keystar theme in sync with the admin in realtime,
// resolving 'auto' against the OS preference.
const THEME_STORAGE_KEY = 'drystack-color-scheme';

function readStoredScheme(): 'auto' | 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw (e.g. blocked cookies) — fall back to auto.
  }
  return 'auto';
}

function prefersDark() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

function resolveScheme(stored: 'auto' | 'light' | 'dark'): 'light' | 'dark' {
  if (stored === 'auto') return prefersDark() ? 'dark' : 'light';
  return stored;
}

function EditorRoot({ config }: { config: Config<any, any> }) {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    resolveScheme(readStoredScheme())
  );
  useEffect(() => {
    const recompute = () => setScheme(resolveScheme(readStoredScheme()));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    // `storage` fires in this (live-site) tab when the admin tab changes the
    // theme; the matchMedia change keeps 'auto' honest as the OS flips.
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === THEME_STORAGE_KEY) recompute();
    };
    window.addEventListener('storage', onStorage);
    mq.addEventListener('change', recompute);
    return () => {
      window.removeEventListener('storage', onStorage);
      mq.removeEventListener('change', recompute);
    };
  }, []);
  return (
    <KeystarProvider colorScheme={scheme}>
      <Toolbar config={config} />
      <Toaster />
    </KeystarProvider>
  );
}

export async function mount(
  config: Config<any, any>,
  buildVersion?: number
): Promise<void> {
  if (document.getElementById(ROOT_ID)) return;

  await discardEditsIfBuildIsNewer(config, buildVersion);
  await applyPendingEdits();
  // Live-sync this page's DOM with edits published from the admin panel or
  // another visual-editor tab — kept active regardless of edit-mode state.
  subscribeToRemoteEdits(config);

  const style = document.createElement('style');
  style.textContent = editorStyles;
  document.head.appendChild(style);

  const host = document.createElement('div');
  host.id = ROOT_ID;
  document.body.appendChild(host);

  createRoot(host).render(<EditorRoot config={config} />);
}
