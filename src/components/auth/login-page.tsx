// 🚪 登录页面组件 - Google OAuth登录界面

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, Loader2, Chrome, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface LoginPageProps {
  className?: string;
}

export function LoginPage({ className }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (error: any) {
      console.error('登录失败:', error);
      setError(error.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 ${className}`}>
      <div className="w-full max-w-md space-y-6">
        {/* Logo和标题 */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-full">
              <Mic className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">面试助手</h1>
          <p className="text-lg text-muted-foreground">
            实时语音转录与智能翻译
          </p>
        </div>

        {/* 登录卡片 */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">欢迎使用</CardTitle>
            <CardDescription className="text-center">
              使用Google账号登录，开始您的智能面试之旅
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full h-12"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  正在登录...
                </>
              ) : (
                <>
                  <Chrome className="mr-2 h-5 w-5" />
                  使用Google账号登录
                </>
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                登录即表示您同意我们的服务条款和隐私政策
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 功能特性 */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-center flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                V2.0 全新特性
              </h3>
              <div className="grid gap-3">
                <FeatureItem 
                  title="多用户支持"
                  description="个人数据完全隔离，安全可靠"
                />
                <FeatureItem 
                  title="云端同步"
                  description="跨设备访问，数据永不丢失"
                />
                <FeatureItem 
                  title="个性化配置"
                  description="自定义岗位模板和JD配置"
                />
                <FeatureItem 
                  title="智能总结"
                  description="基于岗位要求的专业面试分析"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 底部信息 */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            面试助手 V2.0 | 
            <span className="mx-1">•</span>
            基于 GPT-4 和 Whisper API
            <span className="mx-1">•</span>
            实时转录翻译
          </p>
        </div>
      </div>
    </div>
  );
}

interface FeatureItemProps {
  title: string;
  description: string;
}

function FeatureItem({ title, description }: FeatureItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}