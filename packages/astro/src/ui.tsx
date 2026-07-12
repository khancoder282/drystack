import React from 'react';
import type { Config } from '@drystack/core';
import { Drystack as GenericDrystack } from '@drystack/core/ui';

const appSlug = {
  envName: 'PUBLIC_DRYSTACK_GITHUB_APP_SLUG',
  value: import.meta.env.PUBLIC_DRYSTACK_GITHUB_APP_SLUG,
};

export function makePage(config: Config<any, any>, basePath?: string) {
  return function Drystack() {
    return (
      <GenericDrystack
        config={config}
        appSlug={appSlug}
        basePath={basePath}
      />
    );
  };
}
