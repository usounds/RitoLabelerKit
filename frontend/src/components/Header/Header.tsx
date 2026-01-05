"use client";
import LanguageToggle from '@/components/LanguageToggle';
import UserButton from '@/components/User/UserButton';
import { initOAuth } from '@/lib/HandleAgent';
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import { Client } from '@atcute/client';
import { isDid } from '@atcute/lexicons/syntax';
import { OAuthUserAgent, getSession } from '@atcute/oauth-browser-client';
import { Avatar, Group, HoverCard } from '@mantine/core';
import { useLocale, useTranslations } from 'next-intl';
import NextImage from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from "react";
import classes from './Header.module.css';

const links = [
  { href: 'https://blog.usounds.work/posts/rito-labeler-kit-beta-ja', label: 'About' },
];

export default function Header() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
      const t = useTranslations();
  const activeDid = useXrpcAgentStore(state => state.activeDid);
  const userProf = useXrpcAgentStore(state => state.userProf);
  const setUserProf = useXrpcAgentStore(state => state.setUserProf);
  const setThisClient = useXrpcAgentStore(state => state.setThisClient);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname?.includes('/callback') || pathname?.includes('/tos') || pathname?.includes('/policy')) {
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
          <NextImage src='/favicon.png' width={20} height={20} alt="icon" />
          <Link href="/" className={classes.link}>
            {t('title')}
          </Link>
        </Group>

        <Group>
          <Group gap={0}className={classes.links} visibleFrom="xs">
            {items}
            <HoverCard >
              <HoverCard.Target>
                <Avatar src={userProf?.avatar} size={26} />
              </HoverCard.Target>
              {userProf &&
                <HoverCard.Dropdown>
                  <UserButton userProf={userProf} />
                </HoverCard.Dropdown>
              }
            </HoverCard>
          </Group>
            <LanguageToggle />
        </Group>
      </div>
    </header>
  );
}
