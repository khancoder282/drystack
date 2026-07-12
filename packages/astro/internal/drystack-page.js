import { makePage } from '../src/ui.tsx';
// eslint-disable-next-line import/no-unresolved
import config from 'virtual:drystack-config';
// eslint-disable-next-line import/no-unresolved
import path from 'virtual:drystack-path';

export const Drystack = makePage(config, `/${path}`);
