"use client"
import { useState } from 'react';
import cx from 'clsx';
import { ScrollArea, Table, Center, Group } from '@mantine/core';
import classes from './Table.module.css';
import { AppBskyLabelerService } from '@atcute/bluesky';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useDisclosure } from '@mantine/hooks';
import { Modal, Button } from '@mantine/core';
import Edit from '@/components/Edit/Label';
import { useManageStore } from "@/lib/ManageStore";

type LabelValueDefinition = {
    identifier: string;
    severity: string;
    blurs: string;
    adultOnly: boolean;
    defaultSetting: string;
    locales: LocaleText[];
};

type Policies = {
    labelValues: string[];
    labelValueDefinitions: LabelValueDefinition[];
};

interface LocaleText {
    lang: string
    name?: string
    description?: string
}

export function pickLocaleText(
    locales: LocaleText[] | undefined,
    locale: string,
    fallbackLocale = 'en',
): LocaleText | null {
    if (!locales || locales.length === 0) return null

    return (
        locales.find((l) => l.lang === locale) ??
        locales.find((l) => l.lang === fallbackLocale) ??
        locales[0] ??
        null
    )
}

export function TableScrollArea() {
    const [scrolled, setScrolled] = useState(false);
    const [opened, { open, close }] = useDisclosure(false);
    const [editingKey, setEditingKey] = useState<string | undefined>(undefined);
    const locale = useLocale();
    const t = useTranslations('console.manage.label');

    const labelerDef = useManageStore(state => state.labelerDef);
    const setLabelerDef = useManageStore(state => state.setLabelerDef);

    const rows =
        labelerDef?.policies.labelValueDefinitions
            ?.slice() // 元配列を破壊しない
            .map((def) => {
                const text = pickLocaleText(def.locales, locale);

                return (
                    <Table.Tr key={def.identifier} onClick={() => {
                                    setEditingKey(def.identifier);
                                    open();
                                }}>
                        <Table.Td>{def.identifier}</Table.Td>
                        <Table.Td>{text?.name}</Table.Td>
                        <Table.Td>{text?.description?.slice(0,30) ?? '—'}</Table.Td>
                    </Table.Tr>
                );
            }) ?? [];

    return (
        <>

            <Center style={{ width: '100%' }} mt="sm" >
                <Group gap="sm">
                    <Modal
                        opened={opened}
                        onClose={close}
                        closeOnClickOutside={false}
                        title={editingKey ? t('button.edit') : t('button.new')}
                    >
                        <Edit
                            key={editingKey ?? 'new'}   // ← React 用
                            keyLocal={editingKey}       // ← ★これを必ず渡す
                            labelerDef={labelerDef}
                            setLabelerDef={setLabelerDef}
                            close={close}
                        />
                    </Modal>

                    <Button
                        leftSection={<Plus />}
                        onClick={() => {
                            setEditingKey(undefined);
                            open();
                        }}
                    >
                        {t('button.new')}
                    </Button>
                </Group>
            </Center>
            <ScrollArea h={1000} onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
                <Table miw={700}>
                    <Table.Thead
                        className={cx(classes.header, { [classes.scrolled]: scrolled })}
                    >
                        <Table.Tr>
                            <Table.Th>{t('field.key.title')}</Table.Th>
                            <Table.Th>{t('field.title.title')}</Table.Th>
                            <Table.Th>{t('field.description.title')}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>


                    <Table.Tbody>{rows}</Table.Tbody>
                </Table>
            </ScrollArea>
        </>
    );
}
