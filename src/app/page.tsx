import { Button } from "@/components/ui/Button";
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Globe } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent p-1 leading-tight">
          Aliyun DNS Manager
        </h1>
        <p className="text-xl text-gray-400 leading-relaxed">
          极简、安全、现代化的阿里云 DNS 管理工具。<br />
          本地密钥存储，直连阿里云 API，为您提供最流畅的解析管理体验。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <div className="glass p-8 rounded-2xl flex flex-col items-center hover:bg-white/5 transition-all group">
          <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold mb-2">密钥管理</h3>
          <p className="text-gray-400 mb-6 flex-1">
            安全地存储和管理您的 AccessKey。支持多账户切换。
          </p>
          <Link href="/keys">
            <Button variant="secondary" className="group-hover:bg-blue-500 group-hover:text-white transition-all">
              管理密钥 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="glass p-8 rounded-2xl flex flex-col items-center hover:bg-white/5 transition-all group">
          <div className="h-16 w-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Globe className="h-8 w-8 text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold mb-2">DNS 解析</h3>
          <p className="text-gray-400 mb-6 flex-1">
            快速查询、添加和删除域名解析记录。实时生效。
          </p>
          <Link href="/dns">
            <Button variant="secondary" className="group-hover:purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
              管理解析 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
