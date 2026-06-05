'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock } from 'lucide-react';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await loginAction(password);
            if (res.success) {
                window.location.href = '/';
            } else {
                setError(res.error || '登录失败');
            }
        } catch {
            setError('发生错误，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div id="login-page" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0c]">
            <div className="glass p-8 rounded-2xl w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-full text-blue-400 mb-2">
                        <Lock className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">管理后台登入</h1>
                    <p className="text-gray-400 text-sm">请输入管理员密码继续访问管理后台</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <Input
                        label="管理员密码"
                        type="password"
                        placeholder="请输入您的管理员密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && (
                        <p className="text-red-400 text-xs text-center animate-shake">{error}</p>
                    )}

                    <Button type="submit" className="w-full h-12 text-lg" isLoading={isLoading}>
                        验证并进入
                    </Button>
                </form>

                <p className="text-center text-xs text-gray-500">
                    提示：公开部署时请务必配置 `ADMIN_PASSWORD`
                </p>
            </div>
        </div>
    );
}
