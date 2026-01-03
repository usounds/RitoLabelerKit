"use client"
import Ininital from '@/components/Ininital';
import Manage from '@/components/Manage';
import { BlueRitoLabelAutoGetServiceStatus } from '@/lexicons';
import { didDocumentResolver } from '@/lib/HandleAgent';
import { useManageStore } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { Container, Group, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AppBskyLabelerService, } from '@atcute/bluesky';
import semver from 'semver'
type Did = `did:plc:${string}` | `did:web:${string}`;

export function isDid(value: string): value is Did {
    return value.startsWith('did:plc:') || value.startsWith('did:web:');
}

export default function Console() {
    const [mode, setMode] = useState<'loading' | 'initial' | 'manage'>('loading');
    const t = useTranslations('console');
    const setLabelerVersion = useManageStore(state => state.setLabelerVersion);
    const setAutoLabelingVersion = useManageStore(state => state.setAutoLabelingVersion);
    const setAutoLabelingJetstreamCursor = useManageStore(state => state.setAutoLabelingJetstreamCursor);
    const setAutoLabelingQueueCursor = useManageStore(state => state.setAutoLabelingQueueCursor);
    const setServiceEndpoint = useManageStore(state => state.setServiceEndpoint);
    const setLabelerDef = useManageStore(state => state.setLabelerDef);
    const userProf = useXrpcAgentStore(state => state.userProf);
    const activeDid = useXrpcAgentStore(state => state.activeDid);
    const thisClient = useXrpcAgentStore(state => state.thisClient);

    useEffect(() => {
        const handleOnLoad = async () => {
            // キャスト不要！そのまま渡す
            if (!activeDid || !isDid(activeDid)) {
                return;
            }

            const didDoc = await didDocumentResolver.resolve(activeDid)

            const method = didDoc.verificationMethod?.find(
                (vm) => vm.id === `${didDoc.id}#atproto_label`
            );

            const service = didDoc.service?.find(
                (s) => s.type === "AtprotoLabeler"
            );

            let domain: string | undefined;
            if (method && service) {
                try {

                    if (typeof service.serviceEndpoint === "string") {
                        // 文字列なら URL に変換して hostname を取得
                        domain = new URL(service.serviceEndpoint).hostname;
                    } else if (Array.isArray(service.serviceEndpoint)) {
                        // 配列の場合、最初の要素だけ例として処理
                        const first = service.serviceEndpoint[0];
                        if (typeof first === "string") {
                            domain = new URL(first).hostname;
                        }
                    } else if (service.serviceEndpoint && typeof service.serviceEndpoint === "object") {
                        // Record 型の場合、適切なフィールドから URL を取り出す
                        // 例えば serviceEndpoint.url が URL の文字列なら:
                        const urlString = (service.serviceEndpoint as Record<string, string>).url;
                        if (urlString) {
                            domain = new URL(urlString).hostname;
                        }
                    }

                    setServiceEndpoint(`https://${domain}`)


                    try {
                        const getRecord = await fetch(`https://${domain}/xrpc/blue.rito.label.getSetting?nsid=app.bsky.labeler.service`)

                        if (getRecord.ok) {
                            const records = await getRecord.json() as unknown as AppBskyLabelerService.Main;
                            console.log(records)
                            setLabelerDef(records);
                        }
                    } catch {

                        notifications.show({
                            id: 'login-process',
                            title: t('title'),
                            color: "red",
                            autoClose: false,
                            message: t('manage.message.notRunning', {
                                domain: domain ?? 'unknown',
                            }),
                        });

                        return
                    }

                    setMode('manage');
                    const result2 = await fetch(`https://${domain}/xrpc/blue.rito.label.auto.getServiceStatus`)

                    const resultbody = await result2.json() as BlueRitoLabelAutoGetServiceStatus.$output

                    setAutoLabelingVersion(resultbody.version)
                    setAutoLabelingJetstreamCursor(new Date(resultbody.jetstreamCursor))
                    setAutoLabelingQueueCursor(new Date(resultbody.queueCursor))

                    if (semver.lte(resultbody.version, '0.1.3')) {
                        notifications.show({
                            id: 'login-process',
                            title: t('title'),
                            color: "red",
                            message: t('message.versionUp'),
                        });
                    }


                    const result = await fetch(`https://${domain}/xrpc/_health`)
                    const body = await result.json() as { version: string }
                    if (body.version) {
                        setLabelerVersion(body.version)
                    } else {

                        notifications.show({
                            id: 'login-process',
                            title: t('title'),
                            color: "red",
                            message: t('manage.message.notRunning', {
                                domain: domain ?? 'unknown',
                            }),
                        });
                    }




                } catch {

                    notifications.show({
                        id: 'login-process',
                        title: t('title'),
                        color: "red",
                        message: t('manage.message.notRunning', {
                            domain: domain ?? 'unknown',
                        }),
                        autoClose: false
                    });
                }

            } else {
                setMode('initial');
            }
        }
        handleOnLoad();
    }, [activeDid]);

    return (
        <Container size="md" mt="md" my="sx">
            {mode === 'loading' && <Group align="center">
                <Loader size="sm" />
                <Text>{t('message.loading')}</Text>
            </Group>}
            {(mode === 'initial' && userProf) && <Ininital client={thisClient} userProf={userProf} />}
            {mode === 'manage' && <Manage />}
        </Container>
    )

}