'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, Database, User, Settings, RefreshCw, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { createClientComponentClient } from '@/lib/supabase/client';
import { UserProfileService } from '@/services/storage';
import { initializeDatabase, initializeCoreDatabase, type DatabaseInitResult } from '@/lib/supabase/init-database';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function DatabaseDebugPage() {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initResult, setInitResult] = useState<DatabaseInitResult | null>(null);
  const supabase = createClientComponentClient();
  const userProfileService = new UserProfileService();

  const runDiagnostics = async () => {
    setLoading(true);
    const results: DiagnosticResult[] = [];

    try {
      // 1. 检查用户认证状态
      results.push({
        name: '用户认证状态',
        status: user ? 'success' : 'error',
        message: user ? `已登录: ${user.email}` : '用户未登录',
        details: user ? { id: user.id, email: user.email } : null
      });

      if (!user) {
        setDiagnostics(results);
        setLoading(false);
        return;
      }

      // 2. 检查Supabase连接
      try {
        const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
        results.push({
          name: 'Supabase连接',
          status: error ? 'error' : 'success',
          message: error ? `连接失败: ${error.message}` : 'Supabase连接正常',
          details: error || { connectionOk: true }
        });
      } catch (err) {
        results.push({
          name: 'Supabase连接',
          status: 'error',
          message: `连接异常: ${err}`,
          details: err
        });
      }

      // 3. 检查user_profiles表是否存在
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);

        results.push({
          name: 'user_profiles表访问',
          status: error ? 'error' : 'success',
          message: error ? `表访问失败: ${error.message}` : 'user_profiles表访问正常',
          details: { error, data, tableExists: !error }
        });
      } catch (err) {
        results.push({
          name: 'user_profiles表访问',
          status: 'error',
          message: `表访问异常: ${err}`,
          details: err
        });
      }

      // 4. 检查当前用户资料
      try {
        userProfileService.setUserId(user.id);
        const profile = await userProfileService.getProfile();
        results.push({
          name: '用户资料读取',
          status: profile ? 'success' : 'warning',
          message: profile ? '用户资料存在' : '用户资料不存在',
          details: profile
        });
      } catch (err) {
        results.push({
          name: '用户资料读取',
          status: 'error',
          message: `读取失败: ${err}`,
          details: err
        });
      }

      // 5. 测试用户资料创建
      try {
        const testProfile = await userProfileService.upsertProfile({
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '测试用户',
          settings: {
            language: 'zh',
            theme: 'system',
            notifications: true,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          }
        });

        results.push({
          name: '用户资料创建/更新',
          status: testProfile ? 'success' : 'error',
          message: testProfile ? '用户资料创建/更新成功' : '用户资料创建/更新失败',
          details: testProfile
        });
      } catch (err) {
        results.push({
          name: '用户资料创建/更新',
          status: 'error',
          message: `操作失败: ${err}`,
          details: err
        });
      }

      // 6. 测试用户资料更新
      try {
        await userProfileService.updateProfile({
          display_name: '测试更新' + Date.now(),
          settings: {
            language: 'zh',
            theme: 'dark',
            notifications: false,
            autoGenerateSummary: true,
            defaultPrivacyLevel: 'internal'
          }
        });

        results.push({
          name: '用户资料更新测试',
          status: 'success',
          message: '用户资料更新测试成功',
          details: { updateTest: true }
        });
      } catch (err) {
        results.push({
          name: '用户资料更新测试',
          status: 'error',
          message: `更新测试失败: ${err}`,
          details: err
        });
      }

      // 7. 检查position_templates表
      try {
        const { data, error } = await supabase
          .from('position_templates')
          .select('*')
          .eq('user_id', user.id)
          .limit(1);

        results.push({
          name: 'position_templates表访问',
          status: error ? 'error' : 'success',
          message: error ? `表访问失败: ${error.message}` : 'position_templates表访问正常',
          details: { error, data, tableExists: !error }
        });
      } catch (err) {
        results.push({
          name: 'position_templates表访问',
          status: 'error',
          message: `表访问异常: ${err}`,
          details: err
        });
      }

    } catch (globalError) {
      results.push({
        name: '全局错误',
        status: 'error',
        message: `诊断过程中发生全局错误: ${globalError}`,
        details: globalError
      });
    }

    setDiagnostics(results);
    setLoading(false);
  };

  const handleInitializeDatabase = async (coreOnly = false) => {
    setInitializing(true);
    setInitResult(null);

    try {
      const result = coreOnly 
        ? await initializeCoreDatabase()
        : await initializeDatabase();
      
      setInitResult(result);

      // 初始化完成后重新运行诊断
      if (result.success) {
        setTimeout(() => {
          runDiagnostics();
        }, 1000);
      }
    } catch (error) {
      setInitResult({
        success: false,
        message: `初始化失败: ${error}`,
        details: {
          tablesChecked: [],
          tablesCreated: [],
          indexesCreated: false,
          rlsEnabled: false,
          triggersCreated: false
        },
        errors: [`${error}`]
      });
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    if (user) {
      runDiagnostics();
    }
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据库诊断工具
          </CardTitle>
          <CardDescription>
            检查数据库连接、表结构和用户配置功能状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button onClick={runDiagnostics} disabled={loading || initializing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '诊断中...' : '重新诊断'}
            </Button>
            <Button 
              onClick={() => handleInitializeDatabase(true)} 
              disabled={loading || initializing}
              variant="outline"
            >
              <Wrench className={`h-4 w-4 mr-2 ${initializing ? 'animate-pulse' : ''}`} />
              {initializing ? '检查中...' : '检查数据库表'}
            </Button>
            <Button 
              onClick={() => handleInitializeDatabase(false)} 
              disabled={loading || initializing}
              variant="secondary"
            >
              <Database className={`h-4 w-4 mr-2 ${initializing ? 'animate-pulse' : ''}`} />
              {initializing ? '初始化中...' : '完整初始化'}
            </Button>
          </div>

          {/* 初始化结果显示 */}
          {initResult && (
            <Alert 
              variant={initResult.success ? 'default' : 'destructive'} 
              className="mb-6"
            >
              {getStatusIcon(initResult.success ? 'success' : 'error')}
              <AlertDescription>
                <div>
                  <strong>{initResult.message}</strong>
                  {initResult.details.tablesCreated.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm">已创建表: {initResult.details.tablesCreated.join(', ')}</span>
                    </div>
                  )}
                  {initResult.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">查看错误详情</summary>
                      <ul className="mt-1 text-xs">
                        {initResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {diagnostics.map((result, index) => (
              <Alert key={index} variant={result.status === 'error' ? 'destructive' : 'default'}>
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <h4 className="font-medium">{result.name}</h4>
                    <AlertDescription>{result.message}</AlertDescription>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground">
                          查看详细信息
                        </summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </div>

          {diagnostics.length === 0 && !loading && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                请先运行诊断以查看数据库状态
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}