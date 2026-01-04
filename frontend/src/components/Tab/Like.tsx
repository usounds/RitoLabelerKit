"use client"
import { BlueRitoLabelAutoLikeWithRkey, useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { AppBskyLabelerService, } from '@atcute/bluesky';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import * as TID from '@atcute/tid';
import { Alert, Button, Center, Group, Stack, Switch, Textarea, Text, Chip } from '@mantine/core';
import { MessageCircleWarning, Save } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AppBskyFeedPost, AppBskyRichtextFacet } from '@atcute/bluesky';
import { useState, useMemo, useEffect } from 'react';
import { notifications } from '@mantine/notifications';

export const TAG_REGEX =
  // eslint-disable-next-line no-misleading-character-class
  /(^|\s)[#＃]((?!\ufe0f)[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*[^\d\s\p{P}\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]+[^\s\u00AD\u2060\u200A\u200B\u200C\u200D\u20e2]*)?/gu
export const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu

interface KeyNameLang {
    key: string;
    locales: { lang: string; name: string }[];
}

function getMissingKeys(
    main: AppBskyLabelerService.Main,
    like: BlueRitoLabelAutoLikeWithRkey[]
): KeyNameLang[] {
    const labelValues = main.policies?.labelValues ?? [];
    const labelDefs = main.policies?.labelValueDefinitions ?? [];

    return labelValues
        .filter(key => !like.some(l => l.rkey === key))
        .map(key => {
            const def = labelDefs.find(d => d.identifier === key);
            const locales = def?.locales?.map(l => ({ lang: l.lang, name: l.name })) ?? [];
            return { key, locales };
        });
}
type Row = {
    key: string;
    title?: string;
    enabled: boolean;
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

export default function Like() {
    const t = useTranslations('console.manage.like');
    const [description, setDescription] = useState<string>(t('field.post.initial'))
    const [isLoading, setIsLoading] = useState(false);
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const locale = useLocale();
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const like = useManageStore(state => state.like);
    const setLike = useManageStore(state => state.setLike);
    const labelerDef = useManageStore(state => state.labelerDef);
    const likeSettings = useManageStore(state => state.likeSettings);
    const setLikeSettings = useManageStore(state => state.setLikeSettings);
    const useLike = useManageStore(state => state.useLike);
    const setUseLike = useManageStore(state => state.setUseLike);
    const [rowsState, setRowsState] = useState<Row[]>([]);

    const save = async () => {
        setIsLoading(true)

        const writes = []
        let likeSettingsLocal = likeSettings
        let likeLocal = like

        // 設定にまだApplyのPostがなければ作る
        if (!likeSettings?.apply) {
            const rootpost = []
            const rkeyLocal = TID.now();

            //ハッシュタグ
                const facets: AppBskyRichtextFacet.Main[] = [];


                // ハッシュタグ
                let m: RegExpExecArray | null;
                function utf16IndexToUtf8Index(str: string, utf16Index: number): number {
                    return new TextEncoder().encode(str.slice(0, utf16Index)).length;
                }

                while ((m = TAG_REGEX.exec(description))) {
                    const prefix = m[1];
                    let candidateTag = m[2];

                    if (!candidateTag) continue;

                    candidateTag = candidateTag.trim().replace(TRAILING_PUNCTUATION_REGEX, '');

                    if (candidateTag.length === 0 || candidateTag.length > 64) continue;

                    const startPos = m.index + prefix.length;
                    const fullTag = '#' + candidateTag;

                    const byteStart = utf16IndexToUtf8Index(description, startPos);
                    const byteLength = new TextEncoder().encode(fullTag).length;
                    const byteEnd = byteStart + byteLength;

                    facets.push({
                        index: {
                            byteStart,
                            byteEnd,
                        },
                        features: [
                            {
                                $type: 'app.bsky.richtext.facet#tag' as const,
                                tag: candidateTag,
                            },
                        ],
                    });
                }

            rootpost.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}`,
                rkey: rkeyLocal,
                value: {
                    text: description,
                    createdAt: new Date().toISOString(),
                    locale: [locale],
                    facets: facets
                },
            });
            rootpost.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "app.bsky.feed.threadgate" as `${string}.${string}.${string}`,
                rkey: rkeyLocal,
                value: {
                    allow: [
                        { $type: 'app.bsky.feed.threadgate#mentionRule' },
                    ],
                    createdAt: new Date().toISOString(),
                    post: `at://${activeDid}/app.bsky.feed.post/${rkeyLocal}`
                },
            });

            const ret = await thisClient.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: activeDid as ActorIdentifier,
                    writes: rootpost
                }
            });

            if (!ret.ok) {
                console.error('ルートポストに失敗しました')
            }


            if ('results' in ret.data && Array.isArray(ret.data.results)) {
                const firstResult = ret.data.results[0];

                if (firstResult.$type === "com.atproto.repo.applyWrites#createResult") {
                    likeSettingsLocal = {
                        $type: "blue.rito.label.auto.like.settings",
                        apply: {
                            $type: "blue.rito.label.auto.like.settings#postRef",
                            uri: firstResult.uri || '',
                            cid: firstResult.cid || ''
                        },
                        createdAt: new Date().toISOString(),
                    }
                } else {
                    console.error('createResult ではないため apply を設定できません', firstResult);
                }

            } else {
                console.error('results が存在しません', ret.data);
            }
            writes.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "blue.rito.label.auto.like.settings" as `${string}.${string}.${string}`,
                rkey: "self",
                value: likeSettingsLocal as unknown as Record<string, unknown>,
            });

        }

        if (!labelerDef) return

        const enabledKeys = new Set(
            rowsState.filter(r => r.enabled).map(r => r.key)
        );

        const disabledKeys = new Set(
            rowsState.filter(r => !r.enabled).map(r => r.key)
        );

        const toCreate = labelerDef
            ? getMissingKeys(labelerDef, like).filter(diff =>
                enabledKeys.has(diff.key)
            )
            : [];

        for (const diff of toCreate) {
            const now = new Date().toISOString()
            //for (const locale of diff.locales) {
            const rkeyLocal = TID.now();

            writes.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}`,
                rkey: rkeyLocal,
                value: {
                    text: diff.locales[0].name,
                    createdAt: now,
                    locale: [diff.locales[0]],
                    "blue.rito.label.auto.like": diff.key,
                    reply: {
                        root: {
                            cid: likeSettingsLocal?.apply.cid,
                            uri: likeSettingsLocal?.apply.uri,
                            $type: "com.atproto.repo.strongRef"
                        },
                        parent: {
                            cid: likeSettingsLocal?.apply.cid,
                            uri: likeSettingsLocal?.apply.uri,
                            $type: "com.atproto.repo.strongRef"
                        }
                    }
                },
            });

            //}


            likeLocal.push({
                $type: "blue.rito.label.auto.like",
                rkey: diff.key,
                createdAt: now,
                subject: `at://${activeDid}/app.bsky.feed.post/${rkeyLocal}`
            })
        }

        const toDelete = like.filter(l =>
            disabledKeys.has(l.rkey)
        );
        const toDeleteKeys = new Set<string>();

        for (const l of toDelete) {
            const postRkey = l.subject.split('/').pop();
            if (!postRkey) continue;

            // post を削除
            writes.push({
                $type: "com.atproto.repo.applyWrites#delete" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}`,
                rkey: postRkey,
            });

            // like 側のキーを記録
            toDeleteKeys.add(l.rkey);
        }

        // likeLocal からまとめて削除
        likeLocal = likeLocal.filter(l => !toDeleteKeys.has(l.rkey));

        console.log("toCreate", toCreate)
        console.log("enabledKeys", enabledKeys)
        console.log("toDelete", toDelete)
        if (writes.length === 0) {
            setIsLoading(false)
            return
        }

        console.log("writes", writes)

        const ret = await thisClient.post('com.atproto.repo.applyWrites', {
            input: {
                repo: activeDid as ActorIdentifier,
                writes: writes
            }
        });

        if (!ret.ok) {
            console.error(ret.data.message)
        }


        notifications.show({
            id: 'login-process',
            title: 'Success',
            message: t('complete')
        });

        setLike(likeLocal)
        setLikeSettings(likeSettingsLocal)
        setIsLoading(false)
    }

    const remove = async () => {
        setIsLoading(true)

        const writes = []

        // Like - Post
        for (const obj of like) {
            const rkey = obj.subject.split('/').pop()
            if (!rkey) return // or throw
            const postObj = {
                $type: "com.atproto.repo.applyWrites#delete" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}.${string}.${string}`,
                rkey: rkey
            }

            try {
                await thisClient.post('com.atproto.repo.applyWrites', {
                    input: {
                        repo: activeDid as ActorIdentifier,
                        writes: [postObj]
                    }
                });
            } catch {

            }
        }

        // Like Settings
        writes.push({
            $type: "com.atproto.repo.applyWrites#delete" as const,
            collection: "blue.rito.label.auto.like.settings" as `${string}.${string}.${string}.${string}.${string}`,
            rkey: 'self'
        })
        const rkey = likeSettings?.apply.uri.split('/').pop()
        if (!rkey) return // or throw
        const postObj = {
            $type: "com.atproto.repo.applyWrites#delete" as const,
            collection: "app.bsky.feed.post" as `${string}.${string}.${string}.${string}`,
            rkey: rkey
        }

        try {
            await thisClient.post('com.atproto.repo.applyWrites', {
                input: {
                    repo: activeDid as ActorIdentifier,
                    writes: [postObj]
                }
            });
        } catch {

        }
        const ret = await thisClient.post('com.atproto.repo.applyWrites', {
            input: {
                repo: activeDid as ActorIdentifier,
                writes: writes
            }
        });

        if (!ret.ok) {
            console.error(ret.data.message)
        }

        setLike([])
        setLikeSettings(null)
        setIsLoading(false)


    }

    const rows = useMemo(() => {
        return (
            labelerDef?.policies.labelValueDefinitions
                ?.slice()
                .map((def) => {
                    const text = pickLocaleText(def.locales, locale);
                    const likeObj = like.find(l => l.rkey === def.identifier);

                    return {
                        key: def.identifier,
                        title: text?.name ?? def.identifier,
                        enabled: !!likeObj,
                    };
                }) ?? []
        );
    }, [
        labelerDef?.policies.labelValueDefinitions,
        like,
        locale,
    ]);

    useEffect(() => {
        setRowsState(rows);
    }, [rows]);

    const hasEnabled = rowsState.some((r) => r.enabled);

    return (
        <>
            <Stack mt="sm" >

                {(likeSettings) &&
                    <Center>
                        <Button
                            w="auto"
                            variant="outline"
                            onClick={() => {
                                if (likeSettings.apply?.uri) {
                                    const atUri = likeSettings.apply.uri; // ex: "at://did:plc:4voebgh2imlebm5kbaa5ov4v/app.bsky.feed.post/3mb6ogzj5g2wq"
                                    const match = atUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.feed\.post\/(.+)$/);
                                    if (match) {
                                        const did = match[1];
                                        const postId = match[2];
                                        const webUrl = `https://bsky.app/profile/${did}/post/${postId}`;
                                        window.location.href = webUrl;
                                    }
                                }
                            }}
                        >
                            {t('button.view')}
                        </Button>
                    </Center>
                }

                <Switch
                    label={t('field.enable.title')}
                    description={t('field.enable.description')}
                    checked={useLike}
                    onChange={(e) => { setUseLike(e.currentTarget.checked) }}
                />
                {useLike &&
                    <><Stack gap={0}>
                        <Text size="sm">{t('field.likeTarget.title')}</Text>
                        <Text size="xs" c="dimmed">{t('field.likeTarget.description')}</Text>
                        <Group mt="xs">
                            {rowsState.map((row) => (
                                <Chip
                                    key={row.key}
                                    checked={row.enabled}
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
                    </Stack>
                    </>
                }

                {(!likeSettings && useLike) &&
                    <>
                        <Textarea
                            label={t('field.post.title')}
                            description={t('field.post.description')}
                            value={description}
                            maxLength={300}
                            onChange={(e) => setDescription(e.currentTarget.value)}
                        />
                    </>
                }


                {(useLike) &&
                    <Group justify="flex-end">
                        <Button
                            w="auto"
                            onClick={save}
                            loading={isLoading}
                            disabled={isLoading || !hasEnabled}
                            leftSection={<Save />}
                        >
                            {t('button.save')}
                        </Button>
                    </Group>
                }
                {(likeSettings && !useLike) &&
                    <>
                        <Alert variant="light" color="red" icon={<MessageCircleWarning />}>{t('notice')}</Alert>
                        <Group justify="flex-end">
                            <Button w="auto" onClick={remove} color="red" loading={isLoading} disabled={isLoading} leftSection={<Save />}>
                                {t('button.delete')}
                            </Button>
                        </Group>
                    </>
                }
            </Stack>

        </>
    );
}