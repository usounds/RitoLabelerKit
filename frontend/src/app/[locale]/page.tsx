import classes from './page.module.css';
import { routing } from "@/i18n/routing";
import { Cloud } from 'lucide-react';
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Text,
  Title
} from '@mantine/core';
import { LayoutDashboard } from 'lucide-react';
import { BadgeAlert } from 'lucide-react';
import { Login } from "@/components/Login/Login";

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  setRequestLocale(locale);

  const mockdata = [
    {
      title: t('top.1.title'),
      description:
       t('top.1.description'),
      icon: LayoutDashboard,
    },
    {
      title: t('top.2.title'),
      description:
        t('top.2.description'),
      icon: Cloud,
    },
    {
      title: t('top.3.title'),
      description:
        t('top.3.description'),
      icon: BadgeAlert,
    },
  ];


  const features = mockdata.map((feature) => (
    <Card key={feature.title} shadow="md" radius="md" className={classes.card} padding="xl">
      <feature.icon size={50} />
      <Text fz="lg" fw={500} className={classes.cardTitle} mt="md">
        {feature.title}
      </Text>
      <Text fz="sm" c="dimmed" mt="sm">
        {feature.description}
      </Text>
    </Card>
  ));

  return (

    <Container size="lg" py="xl">
      <Group justify="center">
        <Badge variant="filled" size="lg">
          {t('title')}
        </Badge>
      </Group>

      <Title order={2} className={classes.title} ta="center" mt="sm">
        { t('top.welcome') }
      </Title>

      <Text c="dimmed" className={classes.description} ta="center" mt="md">
         { t('top.description') }
      </Text>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt={50}>
        {features}
      </SimpleGrid>

      <Login />
    </Container>
  );
}
