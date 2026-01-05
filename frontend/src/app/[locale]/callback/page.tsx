"use client";
import { initOAuth } from '@/lib/HandleAgent';
import { Client, buildFetchHandler } from '@atcute/client';
import { OAuthUserAgent, finalizeAuthorization } from '@atcute/oauth-browser-client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { Center, Text } from '@mantine/core';
import { Loader } from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function Callback() {
    const setThisClient = useXrpcAgentStore(state => state.setThisClient);
    const setActiveDid = useXrpcAgentStore(state => state.setActiveDid);
    const setUserProf = useXrpcAgentStore(state => state.setUserProf);
    const setThisClientWithProxy = useXrpcAgentStore(state => state.setThisClientWithProxy);
    const locale = useLocale();
    const router = useRouter();
    const t = useTranslations('login');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // hash からパラメータ取得
                const params = new URLSearchParams(location.hash.slice(1));

                // URL をクリーンに
                history.replaceState(null, '', location.pathname + location.search);

                // OAuth 初期化
                initOAuth(locale);
                const { session } = await finalizeAuthorization(params);

                // Agent と RPC 作成
                const agent = new OAuthUserAgent(session);
                const handler = buildFetchHandler({
                    async handle(pathname: string, init: RequestInit) {
                        return agent.handle(pathname, {
                            ...init,
                            headers: {
                                ...(init.headers ?? {}),
                                'atproto-accept-labelers': session.info.sub,
                            },
                        });
                    },
                });

                const rpc = new Client({ handler });

                // ここで Client を state に保存
                setThisClient(rpc);


                const rpcWithPwoxy = new Client({
                    handler:agent, proxy: {
                        serviceId: "#atproto_labeler",
                        did: session.info.sub as `did:${string}:${string}`
                    }
                });
                setThisClientWithProxy(rpcWithPwoxy);

                setActiveDid(session.info.sub);

                const profile = await rpc.get('app.bsky.actor.getProfile', {
                    params: {
                        actor: session.info.sub,
                    },
                });

                if (profile.ok) {
                    setUserProf(profile.data);
                } else {
                    router.replace(`/${locale}/`);
                    console.error('OAuth callback failed', 'Failed to fetch user profile');
                }

                // 完了したら console ページへ遷移
                router.replace(`/${locale}/console`);
            } catch (err) {
                router.replace(`/${locale}/`);
                console.error('OAuth callback failed', err);
            }
        };

        handleCallback();
    }, [locale, router]);

    return <Center style={{ height: '100vh', width: '100%' }}>
        <Loader size="sm" />
        <Text ml="sm">{t('message.inprogress')}</Text>
    </Center>

}