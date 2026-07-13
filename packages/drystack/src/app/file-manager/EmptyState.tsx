import { Icon } from "@keystar/ui/icon";
import { Flex } from "@keystar/ui/layout";
import { Text } from "@keystar/ui/typography";
import { folderClosedIcon } from "#icons/folderClosedIcon";

export function EmptyState(props: { message: string }) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap="regular"
      borderRadius="regular"
      UNSAFE_style={{
        border: "1px dashed var(--kui-color-border-neutral)",
        padding: "3rem 1.5rem",
        textAlign: "center",
      }}
    >
      <Flex
        alignItems="center"
        justifyContent="center"
        backgroundColor="surfaceSecondary"
        borderRadius="full"
        UNSAFE_style={{ width: 48, height: 48, flexShrink: 0 }}
      >
        <Icon src={folderClosedIcon} size="medium" color="neutralTertiary" />
      </Flex>
      <Text color="neutralTertiary">{props.message}</Text>
    </Flex>
  );
}
