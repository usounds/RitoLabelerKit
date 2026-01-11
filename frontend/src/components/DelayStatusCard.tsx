import { Card, Progress, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

type DelayStatusCardProps = {
  from: Date;
  to: Date;
  title: string;
  maxMinutes?: number;
  onClick?: () => void;
};

export function DelayStatusCard({
  from,
  to,
  title,
  maxMinutes = 60,
  onClick,
}: DelayStatusCardProps) {
  const t = useTranslations('console.manage');
  const diffMs = to.getTime() - from.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  const caption =
    diffMinutes <= 1
      ? t('settings.field.delay.nodelay')
      : t('settings.field.delay.description', {
        minute: diffMinutes,
      });

  const progressValue = Math.max(
    0,
    Math.min(100, ((maxMinutes - diffMinutes) / maxMinutes) * 100)
  );

  return (
    <Card
      withBorder
      radius="md"
      mt="sm"
      padding="xl"
      bg="var(--mantine-color-body)"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s ease',
      }}
      className={onClick ? 'hover-card' : ''}
    >
      <style jsx>{`
        .hover-card:hover {
          background-color: var(--mantine-color-gray-0) !important;
        }
        :global([data-mantine-color-scheme="dark"]) .hover-card:hover {
          background-color: var(--mantine-color-dark-6) !important;
        }
      `}</style>
      <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
        {title}
      </Text>

      <Text fz="lg" fw={500}>
        {caption}
      </Text>

      <Progress value={progressValue} mt="md" size="lg" radius="xl" />
    </Card>
  );
}
