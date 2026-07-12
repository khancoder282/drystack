import { ActionButton } from '@keystar/ui/button';
import { Icon } from '@keystar/ui/icon';
import { folderIcon } from '@keystar/ui/icon/icons/folderIcon';
import { Flex } from '@keystar/ui/layout';
import { Text } from '@keystar/ui/typography';

import { DashboardGrid, DashboardSection } from './components';
import { useLocalizedString } from '../shell/i18n';
import { useAppState } from '../shell/context';
import { CurrentBrandChip } from '../deploy/CurrentBrandChip';

// Same footprint as a collection card (lives inside DashboardGrid so it
// picks up the exact same column width), rather than the old full-width bar
// — plus a shortcut into the File Manager, which otherwise only lives in the
// sidebar nav.
export function BranchSection() {
  let localizedString = useLocalizedString();
  let { basePath } = useAppState();

  return (
    <DashboardSection title={localizedString.format('currentBrand')}>
      <DashboardGrid>
        <Flex
          direction="column"
          justifyContent="center"
          gap="medium"
          border="muted"
          borderRadius="medium"
          backgroundColor="canvas"
          padding="large"
        >
          <CurrentBrandChip />
          <ActionButton href={`${basePath}/files`} alignSelf="start">
            <Icon src={folderIcon} />
            <Text>File management</Text>
          </ActionButton>
        </Flex>
      </DashboardGrid>
    </DashboardSection>
  );
}
