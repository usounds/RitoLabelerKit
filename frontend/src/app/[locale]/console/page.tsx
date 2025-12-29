"use client"
import Ininital from '@/components/Ininital';
import Manage from '@/components/Manage';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { isDid, } from '@atcute/lexicons/syntax';
import { Container, Group, Loader, Text } from '@mantine/core';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { didDocumentResolver, isPlcOrWebDid } from '@/lib/HandleAgent';

export default function Console() {
    const [mode, setMode] = useState<'loading' | 'initial' | 'manage'>('loading');
    const t = useTranslations('console');
    const router = useRouter();
    const locale = useLocale();
    const userProf = useXrpcAgentStore(state => state.userProf);
    const thisClient = useXrpcAgentStore(state => state.thisClient);

    useEffect(() => {
        const handleOnLoad = async () => {
            if (!userProf) {
                router.replace(`/${locale}/`);
                return
            }
            if (!thisClient) {
                router.replace(`/${locale}/`);
                return
            }

            if (!isDid(userProf.did)) {
                router.replace(`/${locale}/`);
                return
            }

            // 型ガードで絞る
            if (!isPlcOrWebDid(userProf.did)) {
                router.replace(`/${locale}/`);
                return
            }

            if (!isPlcOrWebDid(userProf.did)) return
            // キャスト不要！そのまま渡す
            const didDoc = await didDocumentResolver.resolve(userProf.did)

            const method = didDoc.verificationMethod?.find(
                (vm) => vm.id === `${didDoc.id}#atproto_label`
            );

            const service = didDoc.service?.find(
                (s) => s.type === "AtprotoLabeler"
            );

            if (method && service) {
                setMode('manage');
            } else {
                setMode('initial');
            }
        }
        handleOnLoad();
    }, []);

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