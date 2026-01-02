"use client"
import { didDocumentResolver, isPlcOrWebDid } from '@/lib/HandleAgent';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import UserButton from "@/components/User/UserButton";
import { AppBskyActorDefs } from '@atcute/bluesky';
import { Client } from '@atcute/client';
import { useRouter } from 'next/navigation';
import { Alert, Button, Center, Group, Stack, Stepper, Text, Textarea, TextInput, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import bs58 from 'bs58';
import { ec as EC } from 'elliptic';
import { MessageCircleWarning } from 'lucide-react';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { OAuthUserAgent, deleteStoredSession, getSession } from '@atcute/oauth-browser-client';
const ec = new EC('secp256k1');

function generateSecp256k1KeyHex(): string {
    const ec = new EC('secp256k1');
    const key = ec.genKeyPair();
    return key.getPrivate('hex');
}

interface InitalProps {
    client: Client;
    userProf: AppBskyActorDefs.ProfileViewDetailed;
}

export default function Inital({ userProf }: InitalProps) {
    const thisClient = useXrpcAgentStore(state => state.thisClient);
    const setUserProf = useXrpcAgentStore(state => state.setUserProf);
    const setActiveDid = useXrpcAgentStore(state => state.setActiveDid);
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('console');
    const [active, setActive] = useState(0);
    const [secKey, setSetSecKey] = useState("");
    const [plcToken, setPlcToken] = useState("");
    const [url, setUrl] = useState("");
    const [appPassword, setAppPassword] = useState("<please get app password from bsky.app.>");
    const [issueAppPassword, setIssueAppPassword] = useState(false);
    const [completedDownload, setCompletedDownload] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [finalConfirm, setFinalConfirm] = useState(false);
    const nextStep = () => setActive((current) => (current < 4 ? current + 1 : current));

    async function generateSecKey() {
        const hex = await generateSecp256k1KeyHex();
        if (issueAppPassword) {
            try {
                const appPass = await thisClient.post('com.atproto.server.createAppPassword', {
                    input: {
                        name: "RioLabelerKit",
                        privileged: false
                    }
                })

                if (appPass.ok) {
                    setAppPassword(appPass.data.password)
                } else {
                    return

                }
            } catch {
                return
            }


        }
        setSetSecKey(hex);
    }

    const downloadSecKey = () => {
        if (!secKey || !userProf?.did) return;

        // ファイル内容を環境変数形式にする
        let content = `LABELER_DID=${userProf.did}\nLABELER_SIGNED_SEC_KEY=${secKey}`;
        if (appPassword) content += `\nLABELER_APP_PASSWORD=${appPassword}`

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'seckey.txt';
        a.click();

        setCompletedDownload(true);
    }

    async function requestPlcOperationSignature() {
        setFinalConfirm(true)

        setIsLoading(true)
        try {
            await thisClient.post('com.atproto.identity.requestPlcOperationSignature', {
                as: 'json', // レスポンス形式
                // input は不要！
            });
        } catch {
            //握りつぶす
        }

        setIsLoading(false)

    }

    async function apply() {
        setIsLoading(true)

        // secKeyからdid:keyを生成
        const keyPair = ec.keyFromPrivate(secKey, 'hex');
        const pubKeyCompressed = new Uint8Array(keyPair.getPublic(true, 'array'));

        const SECP256K1_DID_PREFIX = new Uint8Array([0xe7, 0x01]);
        const prefixed = new Uint8Array([...SECP256K1_DID_PREFIX, ...pubKeyCompressed]);
        const didKey = 'did:key:z' + bs58.encode(prefixed);

        const didDocRes = await thisClient.get('com.atproto.identity.getRecommendedDidCredentials', {
            params: {
            },
        });

        if (!didDocRes.ok) {
            return
        }

        const didDoc = didDocRes.data;

        // service上書き
        didDoc.services = didDoc.services ?? {};
        didDoc.services['atproto_labeler'] = {
            type: 'AtprotoLabeler',
            endpoint: `https://${url}`,
        };

        // 秘密鍵更新
        didDoc.verificationMethods = didDoc.verificationMethods ?? {};
        didDoc.verificationMethods['atproto_label'] = didKey;

        const plcOp = await thisClient.post("com.atproto.identity.signPlcOperation", {
            input: { token: plcToken, ...didDoc },
        });


        if (!plcOp.ok) {
            notifications.show({
                id: 'login-process',
                title: t('title'),
                color: "red",
                message: plcOp.data.message,
            });

            return

        }

        try {

            const ope = await thisClient.post("com.atproto.identity.submitPlcOperation", {
                as: "json",
                input: { operation: plcOp.data.operation },
            });
            if (!ope.ok) {
                notifications.show({
                    id: 'login-process',
                    title: ope.data.error,
                    color: "red",
                    message: ope.data.message,
                });
                return

            }
        } catch {
            //握りつぶす
        }



        if (!isPlcOrWebDid(userProf.did)) return
        const didDoc2 = await didDocumentResolver.resolve(userProf.did)

        const method = didDoc2.verificationMethod?.find(
            (vm) => vm.id === `${didDoc2.id}#atproto_label`
        );

        const service = didDoc2.service?.find(
            (s) => s.type === "AtprotoLabeler"
        );

        if (!method || !service) {
            // 失敗
            return
        }

        nextStep()
        setIsLoading(false)
    }

    async function logout() {
        setIsLoading(true)
        try {
            const session = await getSession(userProf.did, { allowStale: true });
            const agent = new OAuthUserAgent(session);
            await agent.signOut();
        } catch {
            deleteStoredSession(userProf.did); // fallback if signOut fails
        }
        setUserProf(null)
        setActiveDid(null)


        router.replace(`/${locale}/`);
        setIsLoading(false)
    }

    function urlPerse() {
        try {
            // URLをパースしてホストだけ取り出す
            const parsed = new URL(url);
            setUrl(parsed.host); // host 部分だけセット
        } catch (e) {
            // URLが不正な場合はそのままにするか、エラー処理
            console.error('Invalid URL', e);
        }

        nextStep()
    }


    return (
        <>
            <Stepper active={active}>

                {/* 左寄せ */}
                <Stepper.Step
                    label={t('initlal.title.1')}
                    description={t('initlal.description.1')}
                >
                    {/* 左寄せ */}
                    <Stack align="start" >
                        <UserButton userProf={userProf} />

                        {(userProf?.postsCount || 0) > 0 && (
                            <>
                                <Alert
                                    variant="light"
                                    color="red"
                                    icon={<MessageCircleWarning />}
                                    style={{ width: '100%' }}
                                    onClick={logout}
                                >
                                    {t('initlal.posted')}
                                </Alert>
                            </>
                        )}
                    </Stack>

                    {/* 中央寄せボタン */}
                    <Group align="center" justify="center" mt="xl">
                        <Button onClick={nextStep}>{t('initlal.button.next')}</Button>
                    </Group>
                </Stepper.Step>

                <Stepper.Step label={t('initlal.title.2')} description={t('initlal.description.2')}>
                    <TextInput
                        label={t('initlal.url.title')}
                        description={t('initlal.url.description')}
                        placeholder="your.domain.com"
                        value={url}
                        error={url.endsWith('bsky.social') ? t('initlal.url.error.bskydomain') : null}
                        onChange={(event) => setUrl(event.currentTarget.value)}
                    />
                    <Stack align="flex-start" mt="md" >
                        <Center style={{ width: '100%' }}>
                            <Button fullWidth={false} onClick={urlPerse} disabled={url.length < 5}>{t('initlal.button.next')}</Button>
                        </Center>
                    </Stack>
                </Stepper.Step>
                <Stepper.Step label={t('initlal.title.3')} description={t('initlal.description.3')}>
                    {!secKey &&
                        <Stack align="flex-start">
                            <Center style={{ width: '100%' }}>
                                <Alert variant="light" icon={<MessageCircleWarning />}>{t('initlal.seckey')}</Alert>
                            </Center>

                            {/* OAuthではアプリパスワードの発行ができないのでオミット */}
                            {false &&
                                <Switch
                                    label={t('initlal.issueAppPassword.title')}
                                    description={t('initlal.issueAppPassword.description')}
                                    checked={issueAppPassword}
                                    disabled={completedDownload}
                                    onChange={(e) => { setIssueAppPassword(e.currentTarget.checked) }}
                                />
                            }
                            <Center style={{ width: '100%' }}>
                                <Button fullWidth={false} onClick={generateSecKey}>{t('initlal.button.gensecKey')}</Button>
                            </Center>
                        </Stack>
                    }
                    {secKey && (
                        <Stack>
                            <Textarea
                                value={secKey}
                                minRows={1}
                                maxRows={1}
                                readOnly
                            />
                            <Alert variant="light" icon={<MessageCircleWarning />}>{t('initlal.seckeyAreSensitive')}</Alert>

                            <Center style={{ width: '100%' }}>
                                {!completedDownload ? (
                                    <Button fullWidth={false} onClick={downloadSecKey}>{t('initlal.button.downloadsecKey')}</Button>
                                ) : (
                                    <Button fullWidth={false} onClick={nextStep}>{t('initlal.button.next')}</Button>
                                )
                                }
                            </Center>
                        </Stack>
                    )}
                </Stepper.Step>
                <Stepper.Step label={t('initlal.title.4')} description={t('initlal.description.4')}>
                    {!finalConfirm && <>
                        <Center style={{ width: '100%' }} mt="sm">
                            <Text>{t('initlal.plcToken')}</Text>
                            <Button variant="filled" onClick={requestPlcOperationSignature} disabled={finalConfirm}>{t('initlal.button.plcCodeRequest')}</Button>
                        </Center>
                    </>}
                    {finalConfirm && <>
                        <TextInput
                            label={t('initlal.plcTolen.title')}
                            description={t('initlal.plcTolen.description')}
                            placeholder="ABCDE-VWXYZ"
                            value={plcToken}
                            onChange={(event) => setPlcToken(event.currentTarget.value)}
                        />

                        <Center style={{ width: '100%' }} mt="sm">
                            <Button fullWidth={false} color="red" onClick={apply} disabled={plcToken.length < 10 || isLoading}>{t('initlal.button.apply')}</Button>
                        </Center>
                    </>}
                </Stepper.Step>
                <Stepper.Completed>
                    <Text>{t('initlal.complete')}</Text>
                    <Center style={{ width: '100%' }} mt="sm">
                        <Button fullWidth={false} onClick={logout} disabled={isLoading}>{t('initlal.button.logout')}</Button>

                    </Center>
                </Stepper.Completed>
            </Stepper>

        </>
    );
}