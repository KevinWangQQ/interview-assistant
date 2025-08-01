'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Key, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useInterviewStore } from '@/store/interview-store';
import { getTranslationService } from '@/services';

interface ApiSettingsProps {
  className?: string;
}

export function ApiSettings({ className }: ApiSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [errorMessage, setErrorMessage] = useState('');

  const { config, updateConfig } = useInterviewStore();

  useEffect(() => {
    // 从localStorage或配置中加载API密钥
    const savedApiKey = localStorage.getItem('openai_api_key') || config.openaiApiKey;
    if (savedApiKey) {
      setApiKey(savedApiKey);
      testConnection(savedApiKey);
    }
  }, [config.openaiApiKey]);

  const testConnection = async (key: string) => {
    if (!key.trim()) {
      setConnectionStatus('unknown');
      return;
    }

    setIsTestingConnection(true);
    setErrorMessage('');

    try {
      // 创建临时的翻译服务实例来测试连接
      const testService = new (await import('@/services/translation/openai-translation')).OpenAITranslationService(key);
      const isAvailable = await testService.isAvailable();
      
      if (isAvailable) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
        setErrorMessage('API密钥无效或服务不可用');
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || '连接测试失败');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      setErrorMessage('请输入有效的API密钥');
      return;
    }

    // 保存到localStorage和全局配置
    localStorage.setItem('openai_api_key', apiKey);
    updateConfig({ openaiApiKey: apiKey });
    
    // 测试新的API密钥
    testConnection(apiKey);

    alert('API密钥已保存');
  };

  const handleTestConnection = () => {
    testConnection(apiKey);
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            已连接
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            连接失败
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            未测试
          </Badge>
        );
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '••••••••••••••••' + key.substring(key.length - 4);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          API 设置
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* OpenAI API Key 设置 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="openai-api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              OpenAI API Key
            </Label>
            {getConnectionStatusBadge()}
          </div>
          
          <div className="space-y-2">
            <div className="relative">
              <Input
                id="openai-api-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="输入你的 OpenAI API Key (sk-...)"
                value={showApiKey ? apiKey : maskApiKey(apiKey)}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSaveApiKey} size="sm">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button 
                variant="outline" 
                onClick={handleTestConnection} 
                size="sm"
                disabled={isTestingConnection || !apiKey.trim()}
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                测试连接
              </Button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* API 使用说明 */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium text-sm">如何获取 OpenAI API Key：</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>访问 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenAI API Keys 页面</a></li>
            <li>登录你的 OpenAI 账户</li>
            <li>点击 "Create new secret key"</li>
            <li>复制生成的 API Key 并粘贴到上方</li>
            <li>确保账户有足够的余额用于 API 调用</li>
          </ol>
          
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <strong>注意：</strong> API Key 将保存在浏览器本地存储中。请不要在公共设备上保存敏感信息。
          </div>
        </div>

        {/* 语言设置 */}
        <div className="space-y-4">
          <Label className="text-base font-medium">翻译设置</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source-lang" className="text-sm">源语言</Label>
              <select
                id="source-lang"
                className="w-full p-2 border rounded-md bg-background"
                value={config.language.source}
                onChange={(e) => updateConfig({
                  language: { ...config.language, source: e.target.value as 'en' | 'zh' }
                })}
              >
                <option value="en">English (英文)</option>
                <option value="zh">中文</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="target-lang" className="text-sm">目标语言</Label>
              <select
                id="target-lang"
                className="w-full p-2 border rounded-md bg-background"
                value={config.language.target}
                onChange={(e) => updateConfig({
                  language: { ...config.language, target: e.target.value as 'en' | 'zh' }
                })}
              >
                <option value="zh">中文</option>
                <option value="en">English (英文)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 功能开关 */}
        <div className="space-y-4">
          <Label className="text-base font-medium">功能设置</Label>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.autoTranslate}
                onChange={(e) => updateConfig({ autoTranslate: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">自动翻译转录内容</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.autoSuggestQuestions}
                onChange={(e) => updateConfig({ autoSuggestQuestions: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">自动生成问题建议</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}