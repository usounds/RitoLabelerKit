
import { useLocale, useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import cx from 'clsx';
import { useDisclosure } from '@mantine/hooks';
import { Modal, Center, ScrollArea, Table, Button } from '@mantine/core';
import PostForm from '@/components/Edit/Post';
import classes from './Post.module.css';
import { BlueRitoLabelAutoLikeWithRkey, BlueRitoLabelAutoPostWithRkey, useManageStore } from "@/lib/ManageStore";

export default function Post() {
    const t = useTranslations('console.manage.post');
    const [scrolled, setScrolled] = useState(false);
    const [opened, { open, close }] = useDisclosure(false);
    const [editingKey, setEditingKey] = useState<BlueRitoLabelAutoPostWithRkey | undefined>(undefined);
    const post = useManageStore(state => state.post);
    const labelerDef = useManageStore(state => state.labelerDef);

    const labelOptions = useMemo(() => {
        return (labelerDef?.policies?.labelValueDefinitions ?? []).map(def => {
            const ja = def.locales?.find(l => l.lang === 'ja');

            return {
                value: def.identifier,
                label: `[${def.identifier}] ${ja?.name ?? def.identifier}`,
            };
        });
    }, [labelerDef]);


    const sortedPost = useMemo(() => {
        console.log(post)
        if (!post) return [];
        return [...post].sort((a, b) => a.rkey.localeCompare(b.rkey));
    }, [post]);

    return (
        <>
            <Center style={{ width: '100%' }} mt="sm" >
                <Modal
                    opened={opened}
                    onClose={close}
                    closeOnClickOutside={false}
                    title={editingKey ? t('button.edit') : t('button.new')}
                >

                    <PostForm close={close} prev={editingKey} />
                </Modal>
                <Button
                    leftSection={<Plus />}
                    size='xs'
                    onClick={() => {
                        setEditingKey(undefined);
                        open();
                    }}
                >
                    {t('button.new')}
                </Button>
            </Center>
            <ScrollArea h={1000} onScrollPositionChange={({ y }) => setScrolled(y !== 0)}>
                <Table miw={700}>
                    <Table.Thead
                        className={cx(classes.header, { [classes.scrolled]: scrolled })}
                    >
                        <Table.Tr>
                            <Table.Th>{t('field.label.title')}</Table.Th>
                            <Table.Th>{t('field.appliedTo.title')}</Table.Th>
                            <Table.Th>{t('field.condition.title')}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                        {sortedPost.map((def) => (
                            <Table.Tr key={def.rkey}
                                onClick={() => {
                                    setEditingKey(def);
                                    open();
                                }}>
                                <Table.Td>{labelOptions.find(opt => opt.value === def.label)?.label ?? def.label}</Table.Td>
                                <Table.Td>
                                    {def.appliedTo === "account"
                                        ? t('field.appliedTo.account') + "/" + (def.action === 'add' ? t('field.action.add') : t('field.action.remove'))
                                        : t('field.appliedTo.post')}
                                </Table.Td>
                                <Table.Td>{def.condition}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </>
    )

}