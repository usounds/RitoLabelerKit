import { Container, Group, Text } from '@mantine/core';
import {  useTranslations,useLocale } from 'next-intl';
import Link from 'next/link';
import { FaBluesky, FaGithub } from "react-icons/fa6";
import classes from './Footer.module.scss';

export function Footer() {
    
      const t = useTranslations();
      const locale = useLocale()

    return (
        <div className={classes.footer}>
            <Container className={classes.inner}>
                <Text c="dimmed">Developed by usounds.work</Text>

                <Group gap="md" my="sm" wrap="nowrap">

                    <Link href={`/${locale}/tos`} style={{ textDecoration: 'none', cursor: 'pointer', color: 'gray', fontSize: '0.875rem' }}>
                        {t('footer.termofuse')}
                    </Link>
                    <Link href={`/${locale}/policy`} style={{ textDecoration: 'none', cursor: 'pointer', color: 'gray', fontSize: '0.875rem' }}>
                        {t('footer.privacyPolicy')}
                    </Link>

                    <a
                        href="https://bsky.app/profile/rito.blue"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", color: "#666", fontSize: 20 }}
                    >
                        <FaBluesky />
                    </a>

                    <a
                        href="https://github.com/usounds/RitoLabelerKit"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", color: "#666", fontSize: 20 }}
                    >
                        <FaGithub />
                    </a>
                </Group>
            </Container>
        </div>
    );
}
