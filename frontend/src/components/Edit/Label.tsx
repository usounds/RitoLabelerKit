"use client"
import { useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { AppBskyLabelerService } from '@atcute/bluesky';
import { ActorIdentifier } from '@atcute/lexicons';
import * as TID from '@atcute/tid';
import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Save, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from "react";

interface EditProps {
    keyLocal?: string;
    labelerDef: AppBskyLabelerService.Main | null;
    setLabelerDef: (v: AppBskyLabelerService.Main) => void;
    close: () => void;
}

interface LocaleDef {
    lang: string;
    name: string;
    description: string;
}

const EMPTY_LABELER: AppBskyLabelerService.Main = {
    $type: 'app.bsky.labeler.service',
    createdAt: new Date().toISOString(),
    policies: {
        labelValueDefinitions: [],
        labelValues: [],
    },
};

const buildNextLabelerDef = (
    prev: AppBskyLabelerService.Main | null | undefined,
    keyLocal: string,
    locales: LocaleDef[],
    key: string
): AppBskyLabelerService.Main => {

    const base = prev ?? EMPTY_LABELER;

    const policies = base.policies;


    /* labelValueDefinitions */
    const defs = [...(policies.labelValueDefinitions ?? [])];
    const defIndex = defs.findIndex(
        (d) => d.identifier === key
    );

    const newDef = {
        identifier: key,
        blurs: 'none',
        severity: 'inform',
        defaultSetting: "warn",
        adultOnly: false,
        locales,
    };

    if (defIndex === -1) {
        defs.push(newDef);
    } else {
        defs[defIndex] = {
            ...defs[defIndex],
            locales,
        };
    }

    /* labelValues */
    const values = [...(policies.labelValues ?? [])];
    if (!values.includes(key)) {
        values.push(key);
    }

    values.sort((a, b) => a.localeCompare(b));

    return {
        $type: 'app.bsky.labeler.service',
        createdAt:
            base.createdAt,
        policies: {
            ...policies,
            labelValueDefinitions: defs,
            labelValues: values,
        },
    };
};

export default function Edit({
    keyLocal: initialKey,
    labelerDef,
    setLabelerDef,
    close,
}: EditProps) {
    const t = useTranslations('console.manage.label');
    const locale = useLocale();
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const [keyLocal] = useState(initialKey || '');
    const [isLoading, setIsLoading] = useState(false);
    const likeSettings = useManageStore(state => state.likeSettings);
    const like = useManageStore(state => state.like);
    const setLike = useManageStore(state => state.setLike);
    const [locales] = useState<LocaleDef[]>(() => {
        const def =
            labelerDef?.policies?.labelValueDefinitions?.find(
                (d) => d.identifier === keyLocal
            );

        if (def?.locales?.length) {
            return def.locales;
        }

        return [
            {
                lang: locale,
                name: '',
                description: '',
            },
        ];
    });

    // ===== 現在 locale の取得 =====
    const current =
        locales.find((l) => l.lang === locale) ?? locales[0];

    const save = async () => {
        if (form.validate().hasErrors) return

        const nextLocales = locales.map((l) => ({
            ...l,
            name: form.values.name,
            description: form.values.description,
        }));

        const next = buildNextLabelerDef(
            labelerDef!,
            keyLocal,
            nextLocales,
            form.values.key
        );

        setIsLoading(true)
        const ret = await thisClient.post(
            "com.atproto.repo.putRecord",
            {
                input: {
                    repo: activeDid as ActorIdentifier,
                    collection: "app.bsky.labeler.service",
                    rkey: "self",
                    record: next,
                },
            }
        );


        const writes = []

        // Like 自動ラベリング
        if (likeSettings && !initialKey) {
            const now = new Date().toISOString()
            //for (const locale of diff.locales) {
            const rkeyLocal = TID.now();
            writes.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}`,
                rkey: rkeyLocal,
                value: {
                    text: form.values.name,
                    createdAt: now,
                    locale: [locale],
                    reply: {
                        root: {
                            cid: likeSettings.apply.cid,
                            uri: likeSettings.apply.uri,
                            $type: "com.atproto.repo.strongRef"
                        },
                        parent: {
                            cid: likeSettings.apply.cid,
                            uri: likeSettings.apply.uri,
                            $type: "com.atproto.repo.strongRef"
                        }
                    }
                },
            });


            writes.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "blue.rito.label.auto.like" as `${string}.${string}.${string}.${string}.${string}`,
                rkey: form.values.key,
                value: {
                    createdAt: now,
                    subject: `at://${activeDid}/app.bsky.feed.post/${rkeyLocal}`

                }
            });

            const likeLocal = like

            likeLocal.push({
                $type: "blue.rito.label.auto.like",
                rkey: keyLocal,
                createdAt: now,
                subject: `at://${activeDid}/app.bsky.feed.post/${rkeyLocal}`
            })

            const ret = await thisClient.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: activeDid as ActorIdentifier,
                    writes: writes
                }
            })

            if (!ret.ok) {
                console.error(ret.data.message)
            }


            setLike(likeLocal)
        }

        setIsLoading(false)
        if (!ret.ok) return

        setLabelerDef(next);
        close();
    };

    const deleteKey = async () => {
        const buildDeleteLabelerDef = (
            prev: AppBskyLabelerService.Main,
            keyLocal: string
        ): AppBskyLabelerService.Main => {
            const policies = prev.policies ?? {};

            return {
                ...prev,
                policies: {
                    ...policies,

                    // 🔴 定義を削除
                    labelValueDefinitions: (policies.labelValueDefinitions ?? []).filter(
                        (d) => d.identifier !== keyLocal
                    ),

                    // 🔴 値を削除
                    labelValues: (policies.labelValues ?? []).filter(
                        (v) => v !== keyLocal
                    ),
                },
            };
        };

        if (!labelerDef) return

        const next = buildDeleteLabelerDef(labelerDef, keyLocal);

        setIsLoading(true)
        const ret = await thisClient.post(
            "com.atproto.repo.putRecord",
            {
                input: {
                    repo: activeDid as ActorIdentifier,
                    collection: "app.bsky.labeler.service",
                    rkey: "self",
                    record: next,
                },
            }
        );

        if (likeSettings && initialKey) {
            const writes = []
            writes.push({
                $type: "com.atproto.repo.applyWrites#delete" as const,
                collection: "blue.rito.label.auto.like" as `${string}.${string}.${string}.${string}.${string}`,
                rkey: keyLocal
            });


            const matched = like.find(v => v.rkey === keyLocal);
            const rkey = matched?.subject?.split('/').pop();
            if (!rkey) {
                throw new Error('rkey not found');
            }
            writes.push({
                $type: "com.atproto.repo.applyWrites#delete" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}.${string}`,
                rkey: rkey
            });

            const ret = await thisClient.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: activeDid as ActorIdentifier,
                    writes: writes
                }
            })
            if (!ret.ok) return

            if (matched) {
                const nextLike = like.filter(v => v.rkey !== keyLocal);
                setLike(nextLike);
            }
        }

        setIsLoading(false)
        if (!ret.ok) return

        setLabelerDef(next);
        close();
    };


    // フォーム初期化
    const form = useForm({
        initialValues: {
            key: keyLocal || '',
            name: current?.name ?? '',
            description: current?.description ?? '',
        },
        validate: {
            key: (v) => {
                if (!v) return t('field.key.required');

                // 小文字 a-z と - のみ許可
                if (!/^[a-z-]+$/.test(v)) {
                    return t('field.key.validate');
                }

                return null;
            },
            name: (v) => (!v ? t('field.title.required') : null),
            description: (v) => (!v ? t('field.description.required') : null),
        }
    });

    return (
        <Stack>
            <TextInput
                label={t('field.key.title')}
                description={t('field.key.description')}
                placeholder={t('field.key.placeholder')}
                autoCapitalize="none"
                autoComplete="off"
                {...form.getInputProps('key')}
                styles={{ input: { fontSize: 16 } }}
                maxLength={15}
                required
                disabled={!!keyLocal}
            />

            <TextInput
                label={t('field.title.title')}
                description={t('field.title.description')}
                placeholder={t('field.title.placeholder')}
                autoCapitalize="none"
                autoComplete="off"
                maxLength={50}
                styles={{ input: { fontSize: 16 } }}
                required
                {...form.getInputProps('name')}
            />

            <Textarea
                label={t('field.description.title')}
                description={t('field.description.description')}
                placeholder={t('field.description.placeholder')}
                autoCapitalize="none"
                autoComplete="off"
                maxLength={255}
                required
                styles={{ input: { fontSize: 16 } }}
                {...form.getInputProps('description')}
            />

            <Group
                justify={initialKey ? 'space-between' : 'flex-end'}
                mt="md"
            >
                {initialKey && (
                    <Button
                        onClick={() => {
                            if (!confirm(t('info.deleteConfirm'))) return;
                            deleteKey();
                        }}
                        color="red"
                        loading={isLoading}
                        leftSection={<Trash2 />}
                    >
                        {t('button.delete')}
                    </Button>
                )}

                <Button onClick={save} loading={isLoading} leftSection={<Save />}>
                    {t('button.save')}
                </Button>
            </Group>

        </Stack>
    );
}
