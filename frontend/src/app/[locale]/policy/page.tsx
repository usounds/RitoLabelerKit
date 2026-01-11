import fs from "fs";
import path from "path";
import ReactMarkdown from "react-markdown";
import { Container } from "@mantine/core";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: { locale: string };
}

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ja' }];
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  // privacy フォルダ内の md を参照
  const basePath = process.cwd(); // frontend/
  const filePath = path.join(
    basePath,
    "src/app/[locale]/policy",
    `${locale}.md`
  );

  const fallbackPath = path.join(
    basePath,
    "src/app/[locale]/policy/en.md"
  );

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    content = fs.readFileSync(fallbackPath, "utf-8");
  }

  return (
    <Container size="md" mx="auto">
      <ReactMarkdown>{content}</ReactMarkdown>
    </Container>
  );
}
