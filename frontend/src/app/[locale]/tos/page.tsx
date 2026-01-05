import { Container } from "@mantine/core";
import fs from "fs";
import { getTranslations } from "next-intl/server";
import path from "path";
import ReactMarkdown from "react-markdown";

interface PageProps {
  params: { locale: string };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  // privacy フォルダ内の md を参照
const basePath = process.cwd(); // frontend/
const filePath = path.join(
  basePath,
  "src/app/[locale]/tos",
  `${locale}.md`
);

const fallbackPath = path.join(
  basePath,
  "src/app/[locale]/tos/en.md"
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
