"use client"
import { DelayStatusCard } from '@/components/DelayStatusCard';
import { TableScrollArea } from "@/components/LabelTable/Table";
import Like from "@/components/Tab/Like";
import Post from "@/components/Tab/Post";
import Manual from "@/components/Tab/Manual";
import { BlueRitoLabelAutoLikeSettings } from '@/lexicons/index';
import { isPlcOrWebDid } from '@/lib/HandleAgent';
import { BlueRitoLabelAutoLikeWithRkey, BlueRitoLabelAutoPostWithRkey, useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
import { Alert, Button, Group, SimpleGrid, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Cog, FilePenLine, Heart, MessageCircleWarning, Pickaxe, Tag } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';


export default function Manage() {
    const t = useTranslations('console.manage');
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const setLike = useManageStore(state => state.setLike);
    const setPost = useManageStore(state => state.setPost);
    const setLikeSettings = useManageStore(state => state.setLikeSettings);
    const autoLabelingCursor = useManageStore(state => state.autoLabelingJetstreamCursor);
    const autoLabelingQueueCursor = useManageStore(state => state.autoLabelingQueueCursor);
    const serviceEndpoint = useManageStore(state => state.serviceEndpoint);
    const setUseLike = useManageStore(state => state.setUseLike);
    const setAutoLabelingVersion = useManageStore(state => state.setAutoLabelingVersion);
    const setAutoLabelingJetstreamCursor = useManageStore(state => state.setAutoLabelingJetstreamCursor);
    const setAutoLabelingQueueCursor = useManageStore(state => state.setAutoLabelingQueueCursor);
    const isAutoLabelingAvailable = useManageStore(state => state.isAutoLabelingAvailable);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const locale = useLocale();
    const setUserProf = useXrpcAgentStore(state => state.setUserProf);
    const setActiveDid = useXrpcAgentStore(state => state.setActiveDid);

    async function fetchAllLikes(): Promise<BlueRitoLabelAutoLikeWithRkey[]> {
        if (!activeDid) return []
        if (!serviceEndpoint) return []
        if (!isPlcOrWebDid(activeDid)) return []

        const getRecord = await fetch(`${serviceEndpoint}/xrpc/blue.rito.label.auto.like.getSettings`)
        const records = getRecord.json() as unknown as BlueRitoLabelAutoLikeWithRkey[];
        return records;
    }

    async function fetchAllPosts(): Promise<BlueRitoLabelAutoPostWithRkey[]> {
        if (!activeDid) return []
        if (!serviceEndpoint) return []
        if (!isPlcOrWebDid(activeDid)) return []

        const getRecord = await fetch(`${serviceEndpoint}/xrpc/blue.rito.label.auto.post.getSettings`)
        const records = await getRecord.json() as unknown as BlueRitoLabelAutoPostWithRkey[];

        return records;
    }

    async function refreshServiceStatus() {
        if (!serviceEndpoint) return;
        const notificationId = 'refreshing-status';
        notifications.show({
            id: notificationId,
            title: t('title'),
            message: t('message.updatingStatus'),
            loading: true,
            autoClose: false,
            withCloseButton: false,
        });

        try {
            const domain = new URL(serviceEndpoint).hostname;
            const res = await fetch(`https://${domain}/xrpc/blue.rito.label.auto.getServiceStatus`)
            if (res.ok) {
                const resultbody = await res.json()
                setAutoLabelingVersion(resultbody.version)
                setAutoLabelingJetstreamCursor(new Date(resultbody.jetstreamCursor))
                setAutoLabelingQueueCursor(new Date(resultbody.queueCursor))
                notifications.update({
                    id: notificationId,
                    title: t('title'),
                    message: t('message.statusUpdated'),
                    color: "blue",
                    loading: false,
                    autoClose: 1000,
                })
            } else {
                notifications.update({
                    id: notificationId,
                    title: t('title'),
                    message: "Failed to update status",
                    color: "red",
                    loading: false,
                    autoClose: 2000,
                })
            }
        } catch (e) {
            console.error(e)
            notifications.update({
                id: notificationId,
                title: t('title'),
                message: "Error updating status",
                color: "red",
                loading: false,
                autoClose: 2000,
            })
        }
    }

    useEffect(() => {
        if (!activeDid || !thisClient || !serviceEndpoint) {
            return
        }

        if (!isPlcOrWebDid(activeDid)) return
        const handleOnLoad = async () => {
            if (!isAutoLabelingAvailable) return

            const getLikeSettings = await fetch(`${serviceEndpoint}/xrpc/blue.rito.label.getSetting?nsid=blue.rito.label.auto.like.settings`)

            if (getLikeSettings.ok) {
                const records = await getLikeSettings.json() as unknown as BlueRitoLabelAutoLikeSettings.Main;
                if (records) {

                    setLikeSettings(records);
                    setUseLike(true)
                }
            }

            setLike(await fetchAllLikes());
            setPost(await fetchAllPosts());

        }

        handleOnLoad()
    }, [activeDid, thisClient, serviceEndpoint, isAutoLabelingAvailable]);

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

    const isValidDate = (d: Date | null) =>
        d instanceof Date && !isNaN(d.getTime());

    const to = useMemo(() => new Date(), []);

    return (
        <Tabs defaultValue="label">
            <Tabs.List>
                <Tabs.Tab value="label" leftSection={<Tag size={14} />}>
                    {t('tab.label')}
                </Tabs.Tab>
                <Tabs.Tab value="like" leftSection={<Heart size={14} />} disabled={!isAutoLabelingAvailable}>
                    {t('tab.like')}
                </Tabs.Tab>
                <Tabs.Tab value="post" leftSection={<FilePenLine size={14} />} disabled={!isAutoLabelingAvailable}>
                    {t('tab.post')}
                </Tabs.Tab>
                <Tabs.Tab value="manual" leftSection={<Pickaxe size={14} />}>
                    {t('tab.manual')}
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

            <Tabs.Panel value="manual">
                <Manual />
            </Tabs.Panel>

            <Tabs.Panel value="settings">
                <SimpleGrid cols={2} spacing="md">
                    {isValidDate(autoLabelingCursor) && (
                        <DelayStatusCard
                            from={autoLabelingCursor!}
                            to={to}
                            title={t('settings.field.delay.title')}
                            onClick={refreshServiceStatus}
                        />
                    )}

                    {isValidDate(autoLabelingCursor) && isValidDate(autoLabelingQueueCursor) && (
                        <DelayStatusCard
                            from={autoLabelingQueueCursor!}
                            to={autoLabelingCursor!}
                            title={t('settings.field.delay.queue')}
                            onClick={refreshServiceStatus}
                        />
                    )}
                </SimpleGrid>
                {(!isValidDate(autoLabelingCursor) || !isValidDate(autoLabelingQueueCursor)) &&
                    <Group
                        align="center"        // 垂直方向の中央揃え
                        style={{ justifyContent: 'center' }} // 横方向の中央揃え
                        mt="sm"
                    >
                        <Alert variant="light" color='red' icon={<MessageCircleWarning />}>{t('settings.inform.serverdown')}</Alert>
                    </Group>
                }

                <Group
                    align="center"        // 垂直方向の中央揃え
                    style={{ justifyContent: 'center' }} // 横方向の中央揃え
                    mt="sm"
                >
                    <Button onClick={logout} variant="light" color="red" disabled={isLoading} loading={isLoading}>{t('button.logout')}</Button>
                </Group>
            </Tabs.Panel>
        </Tabs>
    );
}