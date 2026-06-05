import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { ToastProvider } from "@/components/ui/Toast";

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
    <html lang="zh-CN">
      <body className={`${inter.className} min-h-screen bg-black/90 text-white selection:bg-blue-500/30`}>
        <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] pointer-events-none opacity-20" />
        <ToastProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
