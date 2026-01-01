import { Avatar, Group, Text, UnstyledButton } from '@mantine/core';
import classes from './UserButton.module.css';
import { AppBskyActorDefs } from '@atcute/bluesky';
interface InitalProps {
    userProf: AppBskyActorDefs.ProfileViewDetailed;
}
export default function UserButton({ userProf }: InitalProps) {
  return (
    <UnstyledButton className={classes.user}>
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
    </UnstyledButton>
  );
}