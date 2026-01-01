"use client";
import { didDocumentResolver, initOAuth, isPlcOrWebDid } from '@/lib/HandleAgent';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { ActorIdentifier } from '@atcute/lexicons/syntax';
import { createAuthorizationUrl } from '@atcute/oauth-browser-client';
import {
    Alert,
    Autocomplete,
    Button,
    Container,
    Group,
    Modal,
    Switch,
    Text,
    Anchor,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LogIn } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from "react";
import classes from './Login.module.css';

export function Login() {
    const [opened, { open, close }] = useDisclosure(false);
    const handle = useXrpcAgentStore(state => state.handle);
    const setHandle = useXrpcAgentStore(state => state.setHandle);
    const publicAgent = useXrpcAgentStore(state => state.publicAgent);
    const userProf = useXrpcAgentStore(state => state.userProf);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [needPlcOpe, setNeePlcOpe] = useState<boolean>(false);
    const [acceptPlcOpe, setAcceptPlcOpe] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const locale = useLocale();
    const router = useRouter();
    const t = useTranslations('login');

    function sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const handleLogin = async () => {
        setIsLoading(true);
        setError('');

        const profile = await publicAgent.get('app.bsky.actor.getProfile', {
            params: {
                actor: handle as ActorIdentifier,
            },
        });

        if (!profile.ok) {
            setError(t('message.nohandle'));
            setIsLoading(false);
            return;
        }

        if (!isPlcOrWebDid(profile.data.did)) return

        //すでにラベラーか？
        if (!acceptPlcOpe) {
            const didDoc = await didDocumentResolver.resolve(profile.data.did)

            const method = didDoc.verificationMethod?.find(
                (vm) => vm.id === `${didDoc.id}#atproto_label`
            );

            const service = didDoc.service?.find(
                (s) => s.type === "AtprotoLabeler"
            );

            if (!method || !service) {
                setNeePlcOpe(true)
                setIsLoading(false);
                return
            }
        }

        initOAuth(locale);
        notifications.show({
            id: 'login-process',
            title: t('title'),
            message: t('message.willauth'),
            loading: true,
            autoClose: false
        });

        let scope = 'atproto transition:generic'

        if (acceptPlcOpe) {
            scope += ' identity:*'
        }

        const authUrl = await createAuthorizationUrl({
            target: { type: 'account', identifier: handle as ActorIdentifier },
            scope: scope,
        });

        await sleep(200); // let browser persist local storage
        window.location.assign(authUrl);

    }

    const handleButton = async () => {
        if (userProf) {
            router.replace(`/${locale}/console`);
            return
        } else {
            open();
        }
    }

    const handleCreateAccount = async () => {

        initOAuth(locale);
        notifications.show({
            id: 'login-process',
            title: t('title'),
            message: t('message.willauth'),
            loading: true,
            autoClose: false
        });

        const authUrl = await createAuthorizationUrl({
            target: { type: 'pds', serviceUrl: 'https://bsky.social/' },
            scope: 'atproto transition:generic identity:*',
        });



        await sleep(200); // let browser persist local storage
        window.location.assign(authUrl);
    }
    const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    return (
        <>
            <Modal opened={opened} onClose={close} title={t('title')}>
                <Container >
                    <Text size="sm" c="dimmed">{t('description')}</Text>
                    <Autocomplete
                        label={t('field.handle')}
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
                        mt="md"
                        required />
                    <Group mt="lg" className={classes.controls}>
                        {needPlcOpe &&
                            <>
                                <Alert
                                    variant="light"
                                    color="red"
                                    title="Alert"
                                    onClick={() => {
                                        window.location.assign('https://railway.com/deploy/YHPVnN?referralCode=Nd-OAk')
                                    }}
                                >
                                    {t('message.plcOpe')}
                                </Alert>
                                <Switch
                                    label={t('field.pleOpe')}
                                    onChange={(event) => setAcceptPlcOpe(event.currentTarget.checked)}
                                />
                            </>}
                    </Group>
                    <Group justify="space-between" mt="sm">
                        <Anchor component="button" type="button" c="dimmed" size="xs" onClick={handleCreateAccount}>{t('button.create')}</Anchor>
                        <Button loading={isLoading} disabled={isLoading} className={classes.control} onClick={handleLogin}>{t('button.login')}</Button>
                    </Group>
                </Container>
            </Modal>
            <Group align="center" justify="center" mt="xl" >
                <Button radius="xl" size="lg" className={classes.control} onClick={handleButton} leftSection={<LogIn size={20} />}>
                    {t('start')}
                </Button>
            </Group>

        </>
    );
}