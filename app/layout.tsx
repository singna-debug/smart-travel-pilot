import type { Metadata } from "next";
import "./globals.css";
import "./url-analyzer.css";
import "./message-creator.css";
import "./chat.css";
import "./buttons.css";
import "./chat-viewer.css";
import "./confirmation.css";
import "./mobile-confirmation.css";
import ClientLayoutWrapper from "./ClientLayoutWrapper";

export const metadata: Metadata = {
  title: "Smart Travel Pilot - Admin Dashboard",
  description: "Travel Consultation Management System",
  keywords: ["Travel", "Admin", "Dashboard", "KakaoTalk"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body style={{ fontFamily: "'Noto Sans KR', sans-serif" }} suppressHydrationWarning={true}>
        <ClientLayoutWrapper>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}
