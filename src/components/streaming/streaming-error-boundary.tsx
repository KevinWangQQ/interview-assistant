// 🛡️ 流式转录错误边界组件
// 优雅处理流式转录过程中的各种错误

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Bug, ExternalLink } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class StreamingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 流式转录错误边界捕获到错误:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // 可以在这里发送错误报告到监控服务
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // 这里可以集成错误监控服务，如 Sentry
    console.log('📊 错误报告:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private getErrorType(error: Error): string {
    if (error.message.includes('MediaRecorder')) {
      return '媒体录制错误';
    }
    if (error.message.includes('getUserMedia')) {
      return '麦克风权限错误';
    }
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return '网络连接错误';
    }
    if (error.message.includes('OpenAI') || error.message.includes('API')) {
      return 'API服务错误';
    }
    return '未知错误';
  }

  private getSolution(error: Error): string[] {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case '媒体录制错误':
        return [
          '检查浏览器是否支持MediaRecorder API',
          '尝试使用Chrome或Edge浏览器',
          '关闭其他占用麦克风的应用程序'
        ];
      case '麦克风权限错误':
        return [
          '点击地址栏的麦克风图标允许权限',
          '检查系统麦克风设备是否正常',
          '尝试刷新页面重新申请权限'
        ];
      case '网络连接错误':
        return [
          '检查网络连接是否正常',
          '尝试切换网络环境',
          '检查防火墙或代理设置'
        ];
      case 'API服务错误':
        return [
          '验证OpenAI API密钥是否有效',
          '检查API额度是否充足',
          '确认网络能访问OpenAI服务'
        ];
      default:
        return [
          '尝试刷新页面',
          '清除浏览器缓存',
          '检查控制台获取详细错误信息'
        ];
    }
  }

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const errorType = error ? this.getErrorType(error) : '未知错误';
      const solutions = error ? this.getSolution(error) : [];

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="h-6 w-6" />
                流式转录服务异常
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">{errorType}</div>
                    <div className="text-sm">{error?.message}</div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="font-semibold">🔧 建议解决方案：</h3>
                <ul className="space-y-2">
                  {solutions.map((solution, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="text-sm">{solution}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重试
                </Button>
                <Button onClick={this.handleReload} variant="outline" className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  刷新页面
                </Button>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  查看详细错误信息
                </summary>
                <div className="mt-3 p-3 bg-gray-100 rounded text-xs font-mono space-y-2">
                  <div>
                    <strong>错误消息:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">{error?.message}</pre>
                  </div>
                  {error?.stack && (
                    <div>
                      <strong>错误堆栈:</strong>
                      <pre className="mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong>组件堆栈:</strong>
                      <pre className="mt-1 whitespace-pre-wrap max-h-32 overflow-y-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>

              <div className="text-center text-sm text-muted-foreground">
                <p>如果问题持续存在，请联系技术支持或查看</p>
                <a 
                  href="https://github.com/anthropics/claude-code/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <Bug className="h-3 w-3" />
                  GitHub Issues
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook版本的错误边界（用于函数组件）
export function useStreamingErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error('🚨 流式转录错误:', error);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError
  };
}

export default StreamingErrorBoundary;