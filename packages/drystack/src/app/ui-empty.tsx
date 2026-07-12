import { Config } from '../config';
import { assertValidRepoConfig } from './repo-config';

export function Drystack(props: {
  config: Config;
  appSlug?: { envName: string; value: string | undefined };
}) {
  if (props.config.storage.kind === 'github') {
    assertValidRepoConfig(props.config.storage.repo);
  }
  return null;
}
