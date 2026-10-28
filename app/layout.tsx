import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "证研 · 投研结论核验台",
  description:
    "把市场观点拆成可验证的主张，以字段级证据约束结论，以人工复核留下研究记录。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
