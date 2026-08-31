import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aliyun DNS Manager | 阿里云 DNS 在线管理",
  description: "极简、安全、高效的阿里云 DNS 在线管理工具，支持多 AccessKey 管理及解析记录实时运维。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning style={{ backgroundColor: 'var(--bg)', minHeight: '100%' }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aliyun-dns-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={inter.className}
        style={{
          backgroundColor: 'var(--bg)',
          color: 'var(--fg)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <ToastProvider>
          <ConfirmProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
