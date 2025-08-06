// 🎧 音频设置引导界面 - Teams会议音频捕获最佳实践

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Speaker, 
  Monitor, 
  CheckCircle, 
  AlertCircle,
  Info,
  Headphones,
  RefreshCw
} from 'lucide-react';
import { useEnhancedWAVStreamingStore } from '@/store/enhanced-wav-streaming-store';

interface AudioSetupGuideProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function AudioSetupGuide({ onComplete, onSkip }: AudioSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const { 
    audioDetection, 
    audioSources, 
    audioQuality,
    detectAudioSources,
    toggleSystemAudio,
    error 
  } = useEnhancedWAVStreamingStore();

  const handleDetectAudioSources = useCallback(async () => {
    setIsDetecting(true);
    try {
      await detectAudioSources();
    } catch (error) {
      console.error('音频源检测失败:', error);
    } finally {
      setIsDetecting(false);
    }
  }, [detectAudioSources]);

  useEffect(() => {
    // 自动开始检测
    handleDetectAudioSources();
  }, [handleDetectAudioSources]);

  const steps = [
    {
      title: '检测音频设备',
      description: '正在检测您的麦克风和系统音频配置...',
      icon: <RefreshCw className="h-6 w-6" />
    },
    {
      title: '配置麦克风',
      description: '确保麦克风权限已开启并正常工作',
      icon: <Mic className="h-6 w-6" />
    },
    {
      title: '设置系统音频',
      description: '为Teams会议配置最佳音频捕获',
      icon: <Speaker className="h-6 w-6" />
    },
    {
      title: '完成设置',
      description: '音频配置已完成，准备开始录制',
      icon: <CheckCircle className="h-6 w-6" />
    }
  ];

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderDetectionStep();
      case 1:
        return renderMicrophoneStep();
      case 2:
        return renderSystemAudioStep();
      case 3:
        return renderCompleteStep();
      default:
        return null;
    }
  };

  const renderDetectionStep = () => (
    <div className="space-y-4">
      {isDetecting ? (
        <div className="text-center py-8">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
          <p className="text-lg font-medium">检测音频设备中...</p>
          <p className="text-sm text-muted-foreground mt-2">
            请确保允许浏览器访问您的麦克风
          </p>
          <Progress value={undefined} className="w-64 mx-auto mt-4" />
        </div>
      ) : audioDetection ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 麦克风状态 */}
            <Card className={`p-4 ${audioDetection.microphoneAvailable ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-3">
                <Mic className={`h-8 w-8 ${audioDetection.microphoneAvailable ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <h3 className="font-medium">麦克风</h3>
                  <p className="text-sm text-muted-foreground">
                    {audioDetection.microphoneAvailable ? '✅ 可用' : '❌ 不可用'}
                  </p>
                </div>
              </div>
            </Card>

            {/* 系统音频状态 */}
            <Card className={`p-4 ${audioDetection.systemAudioAvailable ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
              <div className="flex items-center gap-3">
                <Speaker className={`h-8 w-8 ${audioDetection.systemAudioAvailable ? 'text-green-600' : 'text-yellow-600'}`} />
                <div>
                  <h3 className="font-medium">系统音频</h3>
                  <p className="text-sm text-muted-foreground">
                    {audioDetection.systemAudioAvailable ? '✅ 可用' : '⚠️ 需要设置'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>推荐配置:</strong> {audioDetection.recommendedSetup}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleDetectAudioSources}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重新检测
            </Button>
            <Button 
              onClick={() => setCurrentStep(1)}
              disabled={!audioDetection.microphoneAvailable}
            >
              下一步
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-lg font-medium">检测失败</p>
          <p className="text-sm text-muted-foreground mt-2">
            无法检测音频设备，请检查浏览器权限
          </p>
          <Button 
            onClick={handleDetectAudioSources}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </div>
      )}
    </div>
  );

  const renderMicrophoneStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 border rounded-lg">
        <Mic className="h-8 w-8 text-blue-600" />
        <div className="flex-1">
          <h3 className="font-medium">麦克风设置</h3>
          <p className="text-sm text-muted-foreground">
            您的麦克风将用于录制您的声音
          </p>
        </div>
        <Badge variant={audioSources.microphone.isActive ? "default" : "secondary"}>
          {audioSources.microphone.isActive ? "已连接" : "未连接"}
        </Badge>
      </div>

      {/* 音频质量指示器 */}
      {audioQuality && (
        <div className="p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">音频质量</span>
            <span className="text-sm text-muted-foreground">
              音量: {Math.round(audioQuality.volume * 100)}%
            </span>
          </div>
          <Progress value={audioQuality.volume * 100} className="h-2" />
        </div>
      )}

      <Alert>
        <Headphones className="h-4 w-4" />
        <AlertDescription>
          <strong>最佳实践:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• 使用高质量的耳机麦克风</li>
            <li>• 在安静的环境中录制</li>
            <li>• 保持与麦克风适当的距离</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(0)}>
          上一步
        </Button>
        <Button onClick={() => setCurrentStep(2)}>
          下一步
        </Button>
      </div>
    </div>
  );

  const renderSystemAudioStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 border rounded-lg">
        <Monitor className="h-8 w-8 text-green-600" />
        <div className="flex-1">
          <h3 className="font-medium">系统音频 (Teams会议音频)</h3>
          <p className="text-sm text-muted-foreground">
            捕获Teams会议中其他参与者的声音
          </p>
        </div>
        <Button
          variant={audioSources.systemAudio.isActive ? "default" : "outline"}
          size="sm"
          onClick={() => toggleSystemAudio(!audioSources.systemAudio.isActive)}
        >
          {audioSources.systemAudio.isActive ? "已启用" : "启用"}
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Teams会议设置指南:</strong>
          <ol className="mt-2 space-y-1 text-sm">
            <li>1. 点击上方"启用"按钮</li>
            <li>2. 在弹出的对话框中选择"共享音频"</li>
            <li>3. 选择您的Teams会议窗口</li>
            <li>4. 确保勾选"共享音频"选项</li>
          </ol>
        </AlertDescription>
      </Alert>

      {!audioDetection?.systemAudioAvailable && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            您的浏览器或操作系统不支持系统音频捕获。
            建议使用Chrome浏览器，并确保在Windows系统上运行以获得最佳体验。
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          上一步
        </Button>
        <Button onClick={() => setCurrentStep(3)}>
          完成设置
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4 text-center">
      <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
      <h3 className="text-xl font-semibold">音频配置完成！</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Mic className="h-6 w-6 text-blue-600" />
            <div>
              <p className="font-medium">麦克风</p>
              <p className="text-sm text-muted-foreground">
                {audioSources.microphone.isActive ? '✅ 已配置' : '❌ 未配置'}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Speaker className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium">系统音频</p>
              <p className="text-sm text-muted-foreground">
                {audioSources.systemAudio.isActive ? '✅ 已配置' : '⚠️ 可选'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="text-muted-foreground">
        您现在可以开始录制面试，系统将自动捕获和转录音频内容。
      </p>

      <div className="flex gap-2 justify-center">
        <Button onClick={onComplete} size="lg">
          <CheckCircle className="h-4 w-4 mr-2" />
          开始使用
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 进度指示器 */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              getStepStatus(index) === 'completed' ? 'bg-green-500 border-green-500 text-white' :
              getStepStatus(index) === 'current' ? 'bg-blue-500 border-blue-500 text-white' :
              'bg-gray-100 border-gray-300 text-gray-400'
            }`}>
              {getStepStatus(index) === 'completed' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-20 h-1 mx-2 ${
                getStepStatus(index) === 'completed' ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* 当前步骤信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {steps[currentStep].icon}
            {steps[currentStep].title}
          </CardTitle>
          <p className="text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* 跳过选项 */}
      {onSkip && currentStep < 3 && (
        <div className="text-center">
          <Button variant="ghost" onClick={onSkip}>
            跳过设置，直接开始
          </Button>
        </div>
      )}
    </div>
  );
}

export default AudioSetupGuide;