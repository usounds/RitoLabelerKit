
import { pickLocaleText, Row } from "@/components/Tab/Like";
import { useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { ActorIdentifier } from '@atcute/lexicons';
import { ActionIcon, Autocomplete, Button, Chip, Group, Stack, Text } from '@mantine/core';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { Save } from 'lucide-react';
import type { } from '@atcute/ozone';

export default function Post() {
    const t = useTranslations('console.manage.manual');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearched, setIsSearched] = useState(false);
    const [isSave, setIsSave] = useState(false);
    const [error, setError] = useState<string>('');
    const [did, setDid] = useState<string>('');
    const locale = useLocale();
    const [handle, setHandle] = useState('');
    const publicAgent = useXrpcAgentStore(state => state.publicAgent);
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const thisClientWithProxy = useXrpcAgentStore(state => state.thisClientWithProxy);
    const labelerDef = useManageStore(state => state.labelerDef);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [initialRows, setInitialRows] = useState<Row[]>([]);
    const [rowsState, setRowsState] = useState<Row[]>([]);

    const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsSearched(false)
        const val = event.currentTarget.value;
        if (!val) {
            setSuggestions([]);
            return;
        }

        try {
            const res = await publicAgent.get("app.bsky.actor.searchActorsTypeahead", {
                params: {
                    q: val,
                    limit: 5,
                },
            });

            if (res.ok) {
                // actor.handle を候補として表示
                setSuggestions(res.data.actors.map((a) => a.handle));
            }
        } catch (err) {
            console.error("searchActorsTypeahead error", err);
        }
    };

    useEffect(() => {
        const handleOnLoad = async () => {

        }

        handleOnLoad()
    }, [handle]);

    const handleSearch = async () => {
        if (!thisClient || !handle) return;
        setError('')
        setIsLoading(true);
        setIsSearched(false);

        try {
            const profile = await thisClient.get(
                'app.bsky.actor.getProfile',
                {
                    params: {
                        actor: handle as ActorIdentifier,
                    },
                }
            );

            if (!profile.ok) {
                setIsLoading(false);
                setError(t('inform.nohandle'))
                return

            }

            setDid(profile.data.did)

            const nextRows =
                labelerDef?.policies.labelValueDefinitions
                    ?.map((def) => {
                        const text = pickLocaleText(def.locales, locale);

                        const likeObj = profile.data.labels?.find(
                            (l) => l.val === def.identifier
                        );

                        return {
                            key: def.identifier,
                            title: text?.name ?? def.identifier,
                            enabled: Boolean(likeObj),
                        };
                    }) ?? [];

            setRowsState(nextRows);
            setInitialRows(nextRows);
            setIsSearched(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    const chunkArray = <T,>(array: T[], size: number): T[][] => {
        const result: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    };

    const handleSave = async () => {
        if (!thisClientWithProxy) return;

        setIsLoading(true);

        const subject = {
            $type: 'com.atproto.admin.defs#repoRef',
            did: did as `did:${string}:${string}`,
        } as const;

        try {
            const addChunks = chunkArray(diffLabels.added, 5);
            const removeChunks = chunkArray(diffLabels.removed, 5);

            // 追加ラベル
            for (const chunk of addChunks) {
                const event: {
                    $type: 'tools.ozone.moderation.defs#modEventLabel';
                    createLabelVals: string[];
                    negateLabelVals: string[];
                    durationInHours?: number;
                } = {
                    $type: 'tools.ozone.moderation.defs#modEventLabel',
                    createLabelVals: chunk,
                    negateLabelVals: [],
                };

                await thisClientWithProxy.post(
                    'tools.ozone.moderation.emitEvent',
                    {
                        input: {
                            createdBy: activeDid as `did:${string}:${string}`,
                            subject,
                            event,
                        },
                    }
                );
            }

            // 削除ラベル
            for (const chunk of removeChunks) {
                const event: {
                    $type: 'tools.ozone.moderation.defs#modEventLabel';
                    createLabelVals: string[];
                    negateLabelVals: string[];
                    durationInHours?: number;
                } = {
                    $type: 'tools.ozone.moderation.defs#modEventLabel',
                    createLabelVals: [],
                    negateLabelVals: chunk,
                };

                await thisClientWithProxy.post(
                    'tools.ozone.moderation.emitEvent',
                    {
                        input: {
                            createdBy: activeDid as `did:${string}:${string}`,
                            subject,
                            event,
                        },
                    }
                );
            }

            notifications.show({
                id: 'apply-labels',
                title: 'Success',
                message: t('inform.completed'),
                autoClose: true
            });

            // すべて成功した場合のみ初期状態を更新
            setInitialRows(rowsState);
        } catch (e) {
            console.error('applyLabelForUser failed.');
            console.error(e);

            notifications.show({
                id: 'apply-labels',
                title: 'Error',
                color: 'red',
                message: 'Error:' + e,
                autoClose: true
            });

        } finally {
            setIsLoading(false);
        }
    };


    const diffLabels = useMemo(() => {
        const initialMap = new Map(
            initialRows.map((r) => [r.key, r.enabled])
        );

        const added: string[] = [];
        const removed: string[] = [];

        for (const row of rowsState) {
            const initialEnabled = initialMap.get(row.key);

            if (initialEnabled === false && row.enabled === true) {
                added.push(row.key);
            }

            if (initialEnabled === true && row.enabled === false) {
                removed.push(row.key);
            }
        }

        return { added, removed };
    }, [initialRows, rowsState]);

    return (
        <>
            <Stack>
                <Autocomplete
                    label={t('field.user.title')}
                    description={t('field.user.description')}
                    placeholder="alice.bsky.social"
                    leftSection="@"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    value={handle ?? ''}
                    data={suggestions}
                    onInput={handleInput}
                    onChange={(value) => setHandle(value)}
                    disabled={isLoading}
                    error={error}
                    rightSection={
                        <ActionIcon
                            onClick={handleSearch}
                            loading={isLoading}
                            variant="subtle"
                            aria-label="Search"
                        >
                            <Search size={18} />
                        </ActionIcon>
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();   // フォーム送信や選択確定を防ぐ
                            handleSearch();
                        }
                    }}
                    mt="md"
                    required />
            </Stack>
            <Stack gap={0} mt='sm'>
                <Text size="sm">{t('field.label.title')}</Text>
                <Text size="xs" c="dimmed">{t('field.label.description')}</Text>
                <Group my='sm'>
                    {rowsState.map((row) => (
                        <Chip
                            key={row.key}
                            checked={row.enabled}
                            disabled={!isSearched}
                            onChange={() => {
                                setRowsState((prev) =>
                                    prev.map((r) =>
                                        r.key === row.key
                                            ? { ...r, enabled: !r.enabled }
                                            : r
                                    )
                                );
                            }}
                        >
                            {row.title}
                        </Chip>
                    ))}

                </Group>
                <Group justify="flex-end">
                    <Button
                        disabled={
                            (diffLabels.added.length === 0 &&
                                diffLabels.removed.length === 0) || isLoading
                        }
                        onClick={handleSave}
                        loading={isLoading}
                        leftSection={<Save />}
                    >
                        {t('button.save')}
                    </Button>
                </Group>
            </Stack>
        </>
    );
}