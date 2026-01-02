"use client";
import { initOAuth } from '@/lib/HandleAgent';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { Client } from '@atcute/client';
import { isDid } from '@atcute/lexicons/syntax';
import { OAuthUserAgent, getSession } from '@atcute/oauth-browser-client';
import { Avatar, Group, useMantineTheme } from '@mantine/core';
import { useLocale } from 'next-intl';
import NextImage from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from "react";
import classes from './Header.module.css';

const links = [
  { href: 'https://blog.usounds.work/posts/rito-labeler-kit-beta-ja', label: 'About' },
];

export default function Header() {
  const theme = useMantineTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const activeDid = useXrpcAgentStore(state => state.activeDid);
  const userProf = useXrpcAgentStore(state => state.userProf);
  const setUserProf = useXrpcAgentStore(state => state.setUserProf);
  const setThisClient = useXrpcAgentStore(state => state.setThisClient);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname?.includes('/callback')) {
      return;
    }

    // activeDid が無い → 3秒後にリダイレクト予約
    if (!activeDid) {
      if (!redirectTimerRef.current) {
        redirectTimerRef.current = setTimeout(() => {
          router.replace(`/${locale}/`);
        }, 1000);
      }
      return;
    }

    // activeDid が来た → タイマー解除
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    if (isDid(activeDid) === false) return
    const handleOnLoad = async () => {
      initOAuth(locale);

      try {
        const session = await getSession(activeDid, { allowStale: true });
        const agent = new OAuthUserAgent(session);
        const rpc = new Client({ handler: agent });
        setThisClient(rpc)
        const profile = await rpc.get('app.bsky.actor.getProfile', {
          params: {
            actor: session.info.sub,
          },
        });

        if (profile.ok) {
          setUserProf(profile.data);
        }
      } catch {
        router.replace(`/${locale}/`);
        return
      }
    }
    handleOnLoad();
  }, [activeDid]);

  const items = links.map((link) => (
    <Link
      key={link.label}
      href={link.href}
      className={classes.link}
    >
      {link.label}
    </Link>
  ));

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Group gap="xs">
          <NextImage src='/favicon.png' width={20} height={20} alt="icon"/>
          <Link href="/" className={classes.link}>
            Rito Labeler Console
          </Link>
        </Group>

        <Group>
          <Group ml={50} gap={5} className={classes.links} visibleFrom="sm">
            {items}
            <Avatar src={userProf?.avatar} size={26} />
          </Group>
        </Group>
      </div>
    </header>
  );
}
