// 面试主界面 - 基于WAV流式转录服务

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Mic, MicOff, Loader } from 'lucide-react';
import { useWAVStreamingStore } from '@/store/wav-streaming-store';

export function InterviewMain() {
  const {
    isActive,
    isProcessing,
    currentText,
    currentTranslation,
    error,
    startStreaming,
    stopStreaming,
    clearError
  } = useWAVStreamingStore();

  const handleStartStreaming = () => {
    startStreaming();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              关闭
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 控制面板 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">实时转录与翻译</h2>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">处理中</span>
              </div>
            )}
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "录音中" : "待机"}
            </Badge>
          </div>
        </div>

        <div className="flex gap-4">
          {!isActive ? (
            <Button onClick={handleStartStreaming} size="lg">
              <Mic className="w-4 h-4 mr-2" />
              开始录音
            </Button>
          ) : (
            <Button onClick={stopStreaming} variant="destructive" size="lg">
              <MicOff className="w-4 h-4 mr-2" />
              停止录音
            </Button>
          )}
        </div>
      </div>

      {/* 转录结果显示 */}
      {isActive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 英文原文 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs">英文原文</Badge>
              {isProcessing && currentText && (
                <Loader className="w-3 h-3 animate-spin text-blue-500" />
              )}
            </div>
            <div className="min-h-[200px] text-gray-900 leading-relaxed">
              {currentText || (
                <span className="text-gray-400 italic">
                  等待语音输入...
                </span>
              )}
            </div>
          </div>

          {/* 中文翻译 */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-xs bg-green-100">中文翻译</Badge>
              {currentText && !currentTranslation && (
                <Loader className="w-3 h-3 animate-spin text-green-500" />
              )}
            </div>
            <div className="min-h-[200px] text-gray-900 leading-relaxed">
              {currentTranslation || (
                <span className="text-gray-400 italic">
                  {currentText ? "翻译中..." : "等待转录完成..."}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 使用说明 */}
      {!isActive && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">使用说明</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>1. 点击&ldquo;开始录音&rdquo;</strong> - 开启实时语音转录功能
            </p>
            <p>
              <strong>2. 对着麦克风说英文</strong> - 系统会自动识别并转录
            </p>
            <p>
              <strong>3. 查看中文翻译</strong> - 转录完成后会自动翻译为中文
            </p>
            <p className="text-blue-600 font-medium">
              <strong>技术特点:</strong> 使用WAV格式确保最佳音频质量，支持长时间连续录制
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default InterviewMain;