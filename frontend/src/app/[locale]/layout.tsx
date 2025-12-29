// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import Header from '@/components/Header/Header';
import { createTheme, MantineColorsTuple } from '@mantine/core';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from 'next-intl/server';
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Notifications } from '@mantine/notifications';
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("title"),
    description: t("description"),
  };
}
const myColor: MantineColorsTuple = [
  "#ecf4ff",
  "#dce4f5",
  "#b9c7e2",
  "#94a8d0",
  "#748dc0",
  "#5f7cb7",
  "#5474b4",
  "#44639f",
  "#3a5890",
  "#2c4b80"
];

const theme = createTheme({
  primaryColor: 'myColor',
  colors: {
    myColor,
  },
});

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // 無効な言語の場合は404ページを表示
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }


  setRequestLocale(locale);

  const messages = await getMessages();
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme='dark' />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <MantineProvider defaultColorScheme='dark' theme={theme}>
            <Header />
            <Notifications />
            {children}
          </MantineProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}