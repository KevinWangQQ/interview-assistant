// 增强版面试主界面 - 优化用户体验

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Mic, 
  Loader, 
  Square,
  Clock
} from 'lucide-react';
import { useWAVStreamingStore } from '@/store/wav-streaming-store';

export function EnhancedInterviewMain() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [interviewSummary, setInterviewSummary] = useState<any>(null);
  const [completedSegments, setCompletedSegments] = useState<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    isActive,
    isProcessing,
    currentText,
    currentTranslation,
    segments: storeSegments,
    error,
    startStreaming,
    stopStreaming,
    generateSummaryAndSave,
    clearError
  } = useWAVStreamingStore();

  // 录制时间计时器
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [storeSegments, currentText, currentTranslation, completedSegments, interviewSummary]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      setRecordingTime(0);
      // 清除之前的数据，开始新的面试
      setCompletedSegments([]);
      setInterviewSummary(null);
      setIsGeneratingSummary(false);
      await startStreaming();
    } catch (error) {
      console.error('启动录制失败:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopStreaming();
      
      // 保存当前会话的所有分段到完成状态
      const allSegments = [...storeSegments];
      if (currentText && currentTranslation) {
        // 如果还有未分段的内容，创建最后一个分段
        allSegments.push({
          id: `final-segment-${Date.now()}`,
          timestamp: new Date(),
          englishText: currentText,
          chineseText: currentTranslation,
          speaker: 'candidate',
          confidence: 0.9,
          wordCount: currentText.split(' ').length,
          isComplete: true
        });
      }
      
      setCompletedSegments(allSegments);
      
      // 开始异步生成面试总结并保存到历史记录
      if (allSegments.length > 0) {
        try {
          setIsGeneratingSummary(true);
          console.log('🤖 开始生成并保存面试总结...');
          const summaryResult = await generateSummaryAndSave();
          setInterviewSummary(summaryResult);
          console.log('✅ 面试总结生成并保存完成');
        } catch (error) {
          console.error('❌ 生成面试总结失败:', error);
        } finally {
          setIsGeneratingSummary(false);
        }
      }
    } catch (error) {
      console.error('停止录制失败:', error);
    }
  };

  // 生成面试总结
  const generateInterviewSummary = async (segments: any[]) => {
    try {
      setIsGeneratingSummary(true);
      console.log('🤖 开始生成GPT-4o面试总结...');
      
      // 动态导入GPT-4服务
      const { GPT4InterviewSummaryService } = await import('@/services/interview-summary/gpt4-summary-service');
      const summaryService = new GPT4InterviewSummaryService();
      
      // 生成总结
      const summary = await summaryService.generateInterviewSummary(segments, {
        duration: Math.floor(recordingTime / 60),
        participantCount: 2,
        totalWords: segments.reduce((sum: number, seg: any) => sum + (seg.wordCount || 0), 0),
        questionCount: segments.filter((seg: any) => seg.englishText.includes('?')).length,
        interactionCount: segments.length
      });
      
      setInterviewSummary(summary);
      console.log('✅ 面试总结生成完成');
      
    } catch (error) {
      console.error('❌ 生成面试总结失败:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mx-4 mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              关闭
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 简化的控制面板 */}
      <div className="bg-white shadow-sm border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h2 className="text-lg font-semibold">面试转录</h2>
            {isActive && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatTime(recordingTime)}</span>
                {isProcessing && (
                  <>
                    <Loader className="w-4 h-4 animate-spin ml-2" />
                    <span>处理中</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!isActive && completedSegments.length === 0 ? (
              <Button 
                onClick={handleStartRecording} 
                size="lg"
                className="bg-green-600 hover:bg-green-700"
              >
                <Mic className="w-5 h-5 mr-2" />
                开始录制
              </Button>
            ) : !isActive && completedSegments.length > 0 ? (
              <Button 
                onClick={handleStartRecording} 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Mic className="w-5 h-5 mr-2" />
                开始新面试
              </Button>
            ) : (
              <Button 
                onClick={handleStopRecording}
                size="lg"
                variant="destructive"
              >
                <Square className="w-5 h-5 mr-2" />
                结束录制
              </Button>
            )}
            
            {isGeneratingSummary && (
              <div className="flex items-center gap-2 text-orange-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">正在生成面试总结...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 转录内容显示 - 修复显示问题 */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-4 py-6"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {/* 显示面试总结（如果有） */}
            {interviewSummary && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  🤖 GPT-4o 面试总结
                  <span className="text-sm text-blue-600 font-normal">
                    ({Math.floor(recordingTime / 60)}分钟面试)
                  </span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">整体评估</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {interviewSummary.executiveSummary}
                    </p>
                  </div>
                  
                  {interviewSummary.candidatePerformance && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-green-700 mb-2">优势</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {interviewSummary.candidatePerformance.strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-500 mt-1">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-orange-700 mb-2">待改进</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {interviewSummary.candidatePerformance.weaknesses?.map((weakness: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-orange-500 mt-1">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {interviewSummary.recommendation && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-2">推荐决策</h4>
                      <p className="text-gray-700">{interviewSummary.recommendation.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 显示已完成的分段 */}
            {(isActive ? storeSegments : completedSegments).map((segment: any) => (
              <div key={segment.id} className="bg-white rounded-lg border p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  {new Date(segment.timestamp).toLocaleTimeString()}
                  {segment.speaker && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {segment.speaker === 'interviewer' ? '面试官' : '候选人'}
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="text-gray-900 leading-relaxed">
                    {segment.englishText}
                  </div>
                  
                  <div className="border-l-4 border-blue-200 pl-4 text-gray-700 leading-relaxed">
                    {segment.chineseText}
                  </div>
                </div>
              </div>
            ))}
            
            {/* 显示当前进行中的转录 */}
            {(currentText || currentTranslation) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-xs text-yellow-600 mb-2">
                  实时转录中...
                </div>
                
                <div className="space-y-3">
                  {currentText && (
                    <div className="text-gray-900 leading-relaxed">
                      {currentText}
                    </div>
                  )}
                  
                  {currentTranslation && (
                    <div className="border-l-4 border-yellow-300 pl-4 text-gray-700 leading-relaxed">
                      {currentTranslation}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 等待状态 */}
            {!isActive && storeSegments.length === 0 && (
              <div className="text-center py-12">
                <Mic className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  准备开始面试转录
                </h3>
                <p className="text-gray-500 mb-6">
                  点击"开始录制"按钮开始实时语音转录和翻译
                </p>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>• 支持英文语音实时转录</p>
                  <p>• 自动中文翻译</p>
                  <p>• 智能分段显示</p>
                </div>
              </div>
            )}
            
            {isActive && storeSegments.length === 0 && !currentText && (
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>等待语音输入...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedInterviewMain;