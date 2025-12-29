"use client"
import { TableScrollArea } from "@/components/LabelTable/Table";
import Like from "@/components/Tab/Like";
import Post from "@/components/Tab/Post";
import { ActorIdentifier } from '@atcute/lexicons';
import { BlueRitoLabelAutoLike, BlueRitoLabelAutoPost, BlueRitoLabelAutoLikeSettings } from '@/lexicons/index';
import { isPlcOrWebDid } from '@/lib/HandleAgent';
import { BlueRitoLabelAutoLikeWithRkey, BlueRitoLabelAutoPostWithRkey, useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { AppBskyLabelerService, } from '@atcute/bluesky';
import { Tabs, Button, Group } from '@mantine/core';
import { Cog, FilePenLine, Heart, Tag } from 'lucide-react';
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';

export default function Manage() {
    const t = useTranslations('console.manage');
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const setLike = useManageStore(state => state.setLike);
    const setPost = useManageStore(state => state.setPost);
    const setLabelerDef = useManageStore(state => state.setLabelerDef);
    const setLikeSettings = useManageStore(state => state.setLikeSettings);
    const setUseLike = useManageStore(state => state.setUseLike);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const locale = useLocale();
    const setUserProf = useXrpcAgentStore(state => state.setUserProf);
    const setActiveDid = useXrpcAgentStore(state => state.setActiveDid);

    async function fetchAllLikes(): Promise<BlueRitoLabelAutoLikeWithRkey[]> {
        const result: BlueRitoLabelAutoLikeWithRkey[] = [];
        let cursor: string = '';
        if (!activeDid) return []
        if (!isPlcOrWebDid(activeDid)) return []

        do {
            const getRecord = await thisClient.get("com.atproto.repo.listRecords", {
                params: {
                    repo: activeDid,
                    collection: "blue.rito.label.auto.like",
                    limit: 100,
                    cursor,
                }
            });

            if (!getRecord.ok) break;

            const records = getRecord.data.records;
            for (const r of records) {
                const value = r.value as BlueRitoLabelAutoLike.Main;
                // rkey はここで uri から作る or 任意に設定
                const rkey = r.uri.split("/").pop() ?? "unknown";

                result.push({
                    ...value,
                    rkey,
                });
            }

            cursor = getRecord.data.cursor ?? '';
        } while (cursor);

        return result;
    }

    async function fetchAllPosts(): Promise<BlueRitoLabelAutoPostWithRkey[]> {
        const result: BlueRitoLabelAutoPostWithRkey[] = [];
        let cursor: string = '';
        if (!activeDid) return []
        if (!isPlcOrWebDid(activeDid)) return []

        do {
            const getRecord = await thisClient.get("com.atproto.repo.listRecords", {
                params: {
                    repo: activeDid,
                    collection: "blue.rito.label.auto.post",
                    limit: 100,
                    cursor,
                }
            });

            console.log(getRecord)

            if (!getRecord.ok) break;

            const records = getRecord.data.records;
            for (const r of records) {
                const value = r.value as BlueRitoLabelAutoPost.Main;
                // rkey はここで uri から作る or 任意に設定
                const rkey = r.uri.split("/").pop() ?? "unknown";

                result.push({
                    ...value,
                    rkey,
                });
            }

            cursor = getRecord.data.cursor ?? '';
        } while (cursor);

        return result;
    }

    useEffect(() => {
        if (!activeDid) return
        if (!isPlcOrWebDid(activeDid)) return
        const handleOnLoad = async () => {
            const getRecord = await thisClient.get("com.atproto.repo.getRecord", {
                params: {
                    repo: activeDid,
                    collection: "app.bsky.labeler.service",
                    rkey: 'self'
                },
                as: 'json' // 型によっては必須
            });


            if (getRecord.ok) {
                setLabelerDef(getRecord.data.value as AppBskyLabelerService.Main);
            }


            const getLikeSettings = await thisClient.get("com.atproto.repo.getRecord", {
                params: {
                    repo: activeDid,
                    collection: "blue.rito.label.auto.like.settings",
                    rkey: 'self'
                },
                as: 'json' // 型によっては必須
            });
            if (getLikeSettings.ok) {
                setLikeSettings(getLikeSettings.data.value as BlueRitoLabelAutoLikeSettings.Main);
                setUseLike(true)
            }

            setLike(await fetchAllLikes());

            const like = await fetchAllPosts()
            setPost(like);
            console.log(like)

        }

        handleOnLoad()
    }, []);

    const logout = async () => {
        if (!activeDid) return
        setIsLoading(true)

        try {
            const session = await getSession(activeDid as `did:${string}:${string}`, { allowStale: true });
            const agent = new OAuthUserAgent(session);
            await agent.signOut();
        } catch {
            deleteStoredSession(activeDid as `did:${string}:${string}`); // fallback if signOut fails
        }
        setUserProf(null)
        setActiveDid(null)

        router.replace(`/${locale}/`);
        setIsLoading(false)
        return
    }


    return (
        <Tabs defaultValue="label">
            <Tabs.List>
                <Tabs.Tab value="label" leftSection={<Tag size={14} />}>
                    {t('tab.label')}
                </Tabs.Tab>
                <Tabs.Tab value="like" leftSection={<Heart size={14} />}>
                    {t('tab.like')}
                </Tabs.Tab>
                <Tabs.Tab value="post" leftSection={<FilePenLine size={14} />}>
                    {t('tab.post')}
                </Tabs.Tab>
                <Tabs.Tab value="settings" leftSection={<Cog size={14} />}>
                    {t('tab.settings')}
                </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="label">
                <TableScrollArea />
            </Tabs.Panel>

            <Tabs.Panel value="like">
                <Like />
            </Tabs.Panel>

            <Tabs.Panel value="post">
                <Post />
            </Tabs.Panel>

            <Tabs.Panel value="settings">
                <Group
                    align="center"        // 垂直方向の中央揃え
                    style={{ justifyContent: 'center' }} // 横方向の中央揃え
                    mt="md"
                >
                    <Button onClick={logout} variant="light" color="red" disabled={isLoading} loading={isLoading}>{t('button.logout')}</Button>
                </Group>
            </Tabs.Panel>
        </Tabs>
    );
}