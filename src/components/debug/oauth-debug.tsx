// 🔍 OAuth配置调试组件 - 帮助诊断生产环境OAuth问题

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { validateOAuthConfig, getOAuthCallbackUrl } from '@/lib/oauth-config';
import { AlertTriangle, CheckCircle, Globe, Settings } from 'lucide-react';

interface OAuthDebugProps {
  className?: string;
}

export function OAuthDebug({ className }: OAuthDebugProps) {
  const config = validateOAuthConfig();
  const callbackUrl = getOAuthCallbackUrl();
  
  const envVars = {
    'NODE_ENV': process.env.NODE_ENV,
    'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL ? '已设置' : '未设置',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置'
  };
  
  const clientInfo = typeof window !== 'undefined' ? {
    hostname: window.location.hostname,
    origin: window.location.origin,
    protocol: window.location.protocol,
    userAgent: navigator.userAgent.split(' ').slice(-2).join(' ')
  } : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 配置状态概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {config.isValid ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            OAuth配置状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>配置状态:</span>
              <Badge variant={config.isValid ? "default" : "destructive"}>
                {config.isValid ? "正常" : "有问题"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>回调URL:</span>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {callbackUrl}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 警告信息 */}
      {config.warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <strong>检测到配置问题:</strong>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {config.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 环境变量 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            环境变量
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center text-sm">
                <code className="font-mono">{key}:</code>
                <Badge variant={value && value !== '未设置' ? "default" : "secondary"}>
                  {value || '未设置'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 客户端信息 */}
      {clientInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              客户端环境
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {Object.entries(clientInfo).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-sm">
                  <code className="font-mono">{key}:</code>
                  <span className="text-muted-foreground truncate max-w-[200px]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 解决建议 */}
      <Card>
        <CardHeader>
          <CardTitle>解决建议</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>1. 检查Supabase项目设置</strong>
              <p className="text-muted-foreground">
                在Supabase控制台中确认OAuth回调URL设置正确
              </p>
            </div>
            <div>
              <strong>2. 验证Vercel环境变量</strong>
              <p className="text-muted-foreground">
                确保NEXT_PUBLIC_APP_URL设置为生产域名
              </p>
            </div>
            <div>
              <strong>3. 清除部署缓存</strong>
              <p className="text-muted-foreground">
                在Vercel控制台重新部署以清除缓存
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}