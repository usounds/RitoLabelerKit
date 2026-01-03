"use client"
import { BlueRitoLabelAutoLikeWithRkey, useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { AppBskyLabelerService, } from '@atcute/bluesky';
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import * as TID from '@atcute/tid';
import { Alert, Button, Center, Group, Stack, Switch, Textarea } from '@mantine/core';
import { MessageCircleWarning, Save } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

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

    const save = async () => {
        setIsLoading(true)

        const writes = []
        let likeSettingsLocal = likeSettings
        const likeLocal = like

        // 設定にまだApplyのPostがなければ作る
        if (!likeSettings?.apply) {
            const rootpost = []
            const rkeyLocal = TID.now();

            rootpost.push({
                $type: "com.atproto.repo.applyWrites#create" as const,
                collection: "app.bsky.feed.post" as `${string}.${string}.${string}`,
                rkey: rkeyLocal,
                value: {
                    text: description,
                    createdAt: new Date().toISOString(),
                    locale: [locale]
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

        const diffs = getMissingKeys(labelerDef, like)

        for (const diff of diffs) {
            console.log('Key:', diff.key);
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
                    "blue.rito.label.auto.like":diff.key,
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

        const ret = await thisClient.post('com.atproto.repo.applyWrites', {
            input: {
                repo: activeDid as ActorIdentifier,
                writes: writes
            }
        });

        if (!ret.ok) {
            console.error(ret.data.message)
        }

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

        console.log(writes)

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

    return (
        <Stack mt="sm" >

            {(likeSettings) &&
                <Center>
                    <Button
                        w="auto"
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
            {(!likeSettings && useLike) &&
                <>
                    <Textarea
                        label={t('field.post.title')}
                        description={t('field.post.description')}
                        value={description}
                        maxLength={300}
                        onChange={(e) => setDescription(e.currentTarget.value)}
                    />

                    <Group justify="flex-end">
                        <Button w="auto" onClick={save} loading={isLoading} leftSection={<Save />}>
                            {t('button.save')}
                        </Button>
                    </Group>
                </>
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
    );
}