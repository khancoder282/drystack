import { Heading } from '@keystar/ui/typography';

import { PageBody, PageHeader, PageRoot } from '../shell/page';
import { FileManagerRoot } from './FileManagerRoot';

export function FileManagerPage() {
  return (
    <PageRoot containerWidth="large">
      <PageHeader>
        <Heading elementType="h1" id="page-title" size="small">
          File management
        </Heading>
      </PageHeader>
      <PageBody isScrollable>
        <FileManagerRoot mode={{ kind: 'page' }} />
      </PageBody>
    </PageRoot>
  );
}
