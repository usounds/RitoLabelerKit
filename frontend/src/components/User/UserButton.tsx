import { AppBskyActorDefs } from '@atcute/bluesky';
import { Avatar, Group, Text } from '@mantine/core';
interface InitalProps {
    userProf: AppBskyActorDefs.ProfileViewDetailed;
}
export default function UserButton({ userProf }: InitalProps) {
  return (
      <Group>
        <Avatar
          src={userProf.avatar}
          radius="xl"
        />

        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {userProf.displayName || userProf.handle}
          </Text>

          <Text c="dimmed" size="xs">
            @{userProf.handle}
          </Text>
        </div>

      </Group>
  );
}