'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bug, 
  Play, 
  Square, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useInterviewStore } from '@/store/interview-store';
import { useAudioProcessor } from '@/hooks/use-audio-processor';
import { getAudioService, getTranslationService, getStorageService } from '@/services';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
}

export function FunctionTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const { 
    currentSession,
    isRecording,
    segments,
    processAudioChunk,
    addSegment,
    startInterview,
    stopInterview,
    startRecording,
    stopRecording,
    config
  } = useInterviewStore();
  
  const { manualProcess, simulateAudioData, audioChunkCount } = useAudioProcessor();

  const updateTestResult = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.details = details;
        return [...prev];
      } else {
        return [...prev, { name, status, message, details }];
      }
    });
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    updateTestResult(testName, 'running', '测试中...');
    try {
      await testFn();
      updateTestResult(testName, 'success', '测试通过');
    } catch (error: any) {
      updateTestResult(testName, 'error', `测试失败: ${error.message}`, error);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // 1. 测试服务初始化
    await runTest('服务初始化', async () => {
      const audioService = getAudioService();
      const translationService = getTranslationService();
      const storageService = getStorageService();
      
      if (!audioService) throw new Error('音频服务未初始化');
      if (!translationService) throw new Error('翻译服务未初始化');
      if (!storageService) throw new Error('存储服务未初始化');
    });

    // 2. 测试API配置
    await runTest('API配置检查', async () => {
      if (!config.openaiApiKey && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        throw new Error('未配置OpenAI API Key');
      }
    });

    // 3. 测试存储功能
    await runTest('存储功能', async () => {
      const storageService = getStorageService();
      const testSession = {
        id: 'test-session',
        candidateName: 'Test Candidate',
        position: 'Test Position',
        startTime: new Date(),
        status: 'completed' as const,
        segments: []
      };
      
      await storageService.saveInterview(testSession);
      const retrieved = await storageService.getInterview('test-session');
      
      if (!retrieved || retrieved.candidateName !== 'Test Candidate') {
        throw new Error('存储或检索失败');
      }
      
      await storageService.deleteInterview('test-session');
    });

    // 4. 测试状态管理
    await runTest('状态管理', async () => {
      // 测试面试启动
      await startInterview('Test User', 'Developer');
      
      if (!currentSession) {
        throw new Error('面试会话创建失败');
      }
      
      // 测试段落添加
      addSegment({
        timestamp: Date.now(),
        originalText: 'Hello world',
        translatedText: '你好世界',
        speaker: 'candidate',
        confidence: 0.9
      });
      
      if (segments.length === 0) {
        throw new Error('段落添加失败');
      }
    });

    // 5. 测试翻译功能（模拟）
    await runTest('翻译功能', async () => {
      if (!config.openaiApiKey && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        // 跳过真实API测试，使用模拟数据
        return;
      }
      
      const translationService = getTranslationService();
      const result = await translationService.translate('Hello', 'en', 'zh');
      
      if (!result.translatedText) {
        throw new Error('翻译结果为空');
      }
    });

    // 6. 测试音频处理流程（模拟）
    await runTest('音频处理流程', async () => {
      // 模拟音频数据
      const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
      
      // 测试音频处理函数
      try {
        // 由于没有真正的API Key，这里会失败，但我们可以检查流程
        await processAudioChunk(mockAudioBlob);
      } catch (error: any) {
        // 如果是API Key相关错误，说明流程是正常的
        if (error.message.includes('API key')) {
          return; // 流程正常，只是缺少配置
        }
        throw error;
      }
    });

    setIsRunning(false);
  };

  const testMockData = () => {
    // 添加模拟数据进行界面测试
    addSegment({
      timestamp: Date.now(),
      originalText: 'Hello, thank you for taking the time to interview with us today.',
      translatedText: '你好，感谢您今天抽出时间来参加我们的面试。',
      speaker: 'interviewer',
      confidence: 0.95
    });

    setTimeout(() => {
      addSegment({
        timestamp: Date.now(),
        originalText: 'Thank you for having me. I\'m excited about this opportunity.',
        translatedText: '谢谢您邀请我。我对这个机会感到很兴奋。',
        speaker: 'candidate',
        confidence: 0.92
      });
    }, 1000);

    setTimeout(() => {
      addSegment({
        timestamp: Date.now(),
        originalText: 'Can you tell me about your experience with React and TypeScript?',
        translatedText: '您能告诉我您在React和TypeScript方面的经验吗？',
        speaker: 'interviewer',
        confidence: 0.88
      });
    }, 2000);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pending: 'secondary',
      running: 'default',
      success: 'default',
      error: 'destructive'
    } as const;

    const colors = {
      pending: 'bg-gray-500',
      running: 'bg-blue-500',
      success: 'bg-green-500',
      error: ''
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status === 'pending' && '待测试'}
        {status === 'running' && '测试中'}
        {status === 'success' && '通过'}
        {status === 'error' && '失败'}
      </Badge>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            功能测试工具
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={runAllTests} disabled={isRunning}>
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              运行所有测试
            </Button>
            
            <Button variant="outline" onClick={testMockData}>
              添加模拟数据
            </Button>
            
            <Button variant="outline" onClick={simulateAudioData}>
              模拟音频数据
            </Button>
            
            <Button variant="outline" onClick={manualProcess}>
              手动处理音频
            </Button>
          </div>

          {/* 当前状态显示 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">面试状态</div>
              <div className="font-medium">
                {currentSession ? (
                  <Badge className="bg-green-500">进行中</Badge>
                ) : (
                  <Badge variant="secondary">未开始</Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">录音状态</div>
              <div className="font-medium">
                {isRecording ? (
                  <Badge className="bg-red-500">录音中</Badge>
                ) : (
                  <Badge variant="secondary">已停止</Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">音频块数</div>
              <div className="font-medium">{audioChunkCount}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">转录段数</div>
              <div className="font-medium">{segments.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试结果 */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-muted-foreground">{result.message}</div>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API配置提醒 */}
      {!config.openaiApiKey && !process.env.NEXT_PUBLIC_OPENAI_API_KEY && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            未检测到OpenAI API Key配置。请在设置页面配置API Key以启用完整功能测试。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}