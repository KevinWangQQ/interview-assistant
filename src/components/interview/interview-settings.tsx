// 面试助手设置界面 - MVP版本

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
import { Alert, AlertDescription } from '@/components/ui/alert';

export function InterviewSettings() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // 从localStorage加载API密钥（仅在客户端）
    if (typeof window !== 'undefined') {
      try {
        const savedApiKey = localStorage.getItem('openai_api_key');
        if (savedApiKey) {
          setApiKey(savedApiKey);
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.warn('加载API密钥失败:', error);
      }
    }
  }, []);

  const testApiConnection = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('请输入API密钥');
      setConnectionStatus('error');
      return;
    }

    setIsTestingConnection(true);
    setErrorMessage('');
    
    try {
      // 简单的API测试
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setConnectionStatus('connected');
      } else {
        throw new Error('API密钥验证失败');
      }
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'API连接测试失败');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // 保存到localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('openai_api_key', apiKey.trim());
        } catch (error) {
          console.warn('保存API密钥到localStorage失败:', error);
        }
      }
      
      // 测试连接
      await testApiConnection();
      
      if (connectionStatus !== 'error') {
        alert('设置保存成功！');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            已连接
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">
          <Settings className="h-6 w-6 inline-block mr-2" />
          面试助手设置
        </h1>
        <p className="text-muted-foreground">
          配置API密钥以启用语音转录和翻译功能
        </p>
      </div>

      {/* API密钥设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenAI API 配置
            </span>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="api-key">API 密钥</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={testApiConnection}
                disabled={isTestingConnection || !apiKey.trim()}
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                测试连接
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              请输入您的OpenAI API密钥以启用语音转录和翻译功能
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={saveSettings}
              disabled={isSaving || !apiKey.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>1. 获取API密钥:</strong> 访问 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI API Keys 页面</a> 创建新的API密钥
          </p>
          <p>
            <strong>2. 配置密钥:</strong> 将API密钥粘贴到上方输入框中，点击"测试连接"验证
          </p>
          <p>
            <strong>3. 保存设置:</strong> 验证成功后点击"保存设置"完成配置
          </p>
          <p className="text-blue-600 font-medium">
            <strong>注意:</strong> API密钥会安全地保存在浏览器本地存储中，不会上传到服务器
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default InterviewSettings;