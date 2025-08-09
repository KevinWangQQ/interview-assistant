// 🌏 长翻译场景优化的面试界面 - 聚焦翻译文本用户体验

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertCircle, 
  Mic, 
  Square,
  Clock,
  User,
  Briefcase,
  Pause,
  Play,
  Settings,
  Maximize2,
  Minimize2,
  Type,
  Volume2,
  ChevronUp,
  ChevronDown,
  Copy,
  Download,
  Zap
} from 'lucide-react';
import { useWAVStreamingStore } from '@/store/wav-streaming-store';

interface DisplayMode {
  translationSize: 'small' | 'medium' | 'large' | 'xlarge';
  showEnglish: boolean;
  showTimestamps: boolean;
  showSpeakers: boolean;
  compactMode: boolean;
  darkMode: boolean;
  highlightRecent: boolean;
}

export function TranslationFocusedInterview() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [candidateName, setCandidateName] = useState('');
  const [position, setPosition] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const latestSegmentRef = useRef<HTMLDivElement>(null);
  
  // 显示模式配置
  const [displayMode, setDisplayMode] = useState<DisplayMode>({
    translationSize: 'large',
    showEnglish: true,
    showTimestamps: false,
    showSpeakers: true,
    compactMode: false,
    darkMode: false,
    highlightRecent: true
  });

  const {
    isActive,
    isPaused,
    isProcessing,
    currentText,
    currentTranslation,
    segments: storeSegments,
    completedSegments: storeCompletedSegments,
    interviewInfo,
    error,
    startStreaming,
    stopStreaming,
    pauseStreaming,
    resumeStreaming,
    generateSummaryAndSave,
    clearError
  } = useWAVStreamingStore();

  // 组件挂载时从store恢复状态
  useEffect(() => {
    if (interviewInfo) {
      setCandidateName(interviewInfo.candidateName);
      setPosition(interviewInfo.position);
    }
  }, [interviewInfo]);

  // 录制时间计时器
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  // 自动滚动到最新内容
  useEffect(() => {
    if (displayMode.highlightRecent && latestSegmentRef.current) {
      latestSegmentRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }
  }, [storeSegments, currentText, currentTranslation, displayMode.highlightRecent]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      setRecordingTime(0);
      const interviewInfo = {
        candidateName: candidateName.trim() || 'unknown',
        position: position.trim() || '未指定岗位'
      };
      await startStreaming(interviewInfo);
    } catch (error) {
      console.error('启动录制失败:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopStreaming();
      // 生成总结
      if (storeSegments.length > 0) {
        try {
          await generateSummaryAndSave();
        } catch (error) {
          console.error('❌ 生成面试总结失败:', error);
        }
      }
    } catch (error) {
      console.error('停止录制失败:', error);
    }
  };

  const copyAllTranslations = () => {
    const allTranslations = storeSegments
      .filter(seg => seg.chineseText)
      .map(seg => {
        let text = '';
        if (displayMode.showTimestamps && seg.timestamp) {
          text += `[${new Date(seg.timestamp).toLocaleTimeString()}] `;
        }
        if (displayMode.showSpeakers && seg.speaker) {
          text += `${seg.speaker === 'interviewer' ? '面试官' : '候选人'}: `;
        }
        text += seg.chineseText;
        return text;
      })
      .join('\n\n');

    navigator.clipboard.writeText(allTranslations);
    alert('翻译文本已复制到剪贴板');
  };

  const exportTranslations = () => {
    const allTranslations = storeSegments
      .filter(seg => seg.chineseText)
      .map(seg => {
        const timestamp = new Date(seg.timestamp).toLocaleString();
        const speaker = seg.speaker === 'interviewer' ? '面试官' : '候选人';
        return `时间: ${timestamp}\n说话人: ${speaker}\n英文: ${seg.englishText}\n中文: ${seg.chineseText}\n`;
      })
      .join('\n---\n\n');

    const blob = new Blob([allTranslations], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-translation-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTextSizeClass = () => {
    switch (displayMode.translationSize) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-base';
      case 'large': return 'text-lg';
      case 'xlarge': return 'text-xl';
      default: return 'text-lg';
    }
  };

  const getLineHeightClass = () => {
    switch (displayMode.translationSize) {
      case 'small': return 'leading-normal';
      case 'medium': return 'leading-relaxed';
      case 'large': return 'leading-loose';
      case 'xlarge': return 'leading-loose';
      default: return 'leading-loose';
    }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${displayMode.darkMode ? 'bg-gray-900 text-white' : 'bg-background'}`}>
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

      {/* 顶部控制栏 */}
      <div className={`${displayMode.darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b p-4 flex-shrink-0 ${displayMode.compactMode ? 'py-2' : 'py-4'}`}>
        <div className="flex items-center justify-between">
          {/* 左侧：面试信息 */}
          <div className="flex items-center gap-4">
            {!isActive && storeSegments.length === 0 ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <Input
                    placeholder="应聘人姓名"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-32 h-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  <Input
                    placeholder="面试岗位"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-32 h-8"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">{candidateName || 'unknown'}</span>
                </div>
                {position && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{position}</span>
                  </div>
                )}
                {isActive && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
                    {isProcessing && (
                      <Badge variant="secondary" className="text-xs">
                        处理中
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧：控制按钮 */}
          <div className="flex items-center gap-2">
            {/* 显示设置 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={showSettings ? 'bg-primary/10' : ''}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* 全屏切换 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>

            {/* 录制控制 */}
            {!isActive ? (
              <Button 
                onClick={handleStartRecording} 
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <Mic className="w-4 h-4 mr-2" />
                开始翻译
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {!isPaused ? (
                  <Button 
                    onClick={pauseStreaming}
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-600"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    暂停
                  </Button>
                ) : (
                  <Button 
                    onClick={resumeStreaming}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    继续
                  </Button>
                )}
                
                <Button 
                  onClick={handleStopRecording}
                  size="sm"
                  variant="destructive"
                >
                  <Square className="w-4 h-4 mr-1" />
                  结束
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <Card className="mx-4 mb-4 flex-shrink-0">
          <CardContent className="pt-4">
            <Tabs defaultValue="display" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="display">显示</TabsTrigger>
                <TabsTrigger value="content">内容</TabsTrigger>
                <TabsTrigger value="export">导出</TabsTrigger>
              </TabsList>

              <TabsContent value="display" className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">翻译文字大小</Label>
                    <div className="flex gap-1">
                      {[
                        { key: 'small', label: 'S' },
                        { key: 'medium', label: 'M' },
                        { key: 'large', label: 'L' },
                        { key: 'xlarge', label: 'XL' }
                      ].map(({ key, label }) => (
                        <Button
                          key={key}
                          variant={displayMode.translationSize === key ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDisplayMode(prev => ({ ...prev, translationSize: key as any }))}
                          className="w-10 h-8"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">显示英文</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.showEnglish}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, showEnglish: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">显示时间</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.showTimestamps}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, showTimestamps: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">显示说话人</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.showSpeakers}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, showSpeakers: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">紧凑模式</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.compactMode}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, compactMode: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">深色模式</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.darkMode}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, darkMode: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">突出最新</Label>
                    <input
                      type="checkbox"
                      checked={displayMode.highlightRecent}
                      onChange={(e) => setDisplayMode(prev => ({ ...prev, highlightRecent: e.target.checked }))}
                      className="h-4 w-4"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="content" className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>转录段数: {storeSegments.length}</span>
                  <span>翻译段数: {storeSegments.filter(s => s.chineseText).length}</span>
                  <span>总时长: {formatTime(recordingTime)}</span>
                </div>
              </TabsContent>

              <TabsContent value="export" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={copyAllTranslations}
                    size="sm"
                    variant="outline"
                    disabled={storeSegments.filter(s => s.chineseText).length === 0}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    复制翻译
                  </Button>
                  <Button 
                    onClick={exportTranslations}
                    size="sm"
                    variant="outline"
                    disabled={storeSegments.filter(s => s.chineseText).length === 0}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    导出文本
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 主要翻译内容区域 */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-4 py-6"
          style={{
            backgroundColor: displayMode.darkMode ? '#1f2937' : '#ffffff'
          }}
        >
          <div className="max-w-5xl mx-auto space-y-4">
            {storeSegments.length === 0 && !isActive ? (
              <div className="text-center py-16">
                <div className="space-y-4">
                  <Volume2 className={`h-16 w-16 mx-auto ${displayMode.darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                  <h3 className={`text-xl font-medium ${displayMode.darkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    准备开始实时翻译
                  </h3>
                  <p className={`${displayMode.darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    点击"开始翻译"开始实时英文转录和中文翻译
                  </p>
                  <div className={`text-sm ${displayMode.darkMode ? 'text-gray-600' : 'text-gray-400'} space-y-1`}>
                    <p className="flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4" />
                      优化长时间翻译体验
                    </p>
                    <p>• 大字体翻译显示</p>
                    <p>• 自动滚动跟踪</p>
                    <p>• 实时复制导出</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {storeSegments.map((segment: any, index: number) => {
                  const isRecent = index >= storeSegments.length - 3;
                  const isTemporary = segment.isTemporary;
                  
                  return (
                    <div 
                      key={segment.id} 
                      ref={index === storeSegments.length - 1 ? latestSegmentRef : undefined}
                      className={`space-y-3 transition-all duration-500 ${
                        isRecent && displayMode.highlightRecent 
                          ? `${displayMode.darkMode ? 'bg-gray-800' : 'bg-blue-50'} p-4 rounded-lg border-l-4 ${displayMode.darkMode ? 'border-blue-400' : 'border-blue-400'}` 
                          : isTemporary 
                            ? `${displayMode.darkMode ? 'bg-yellow-900/20' : 'bg-amber-50'} p-3 rounded-lg` 
                            : ''
                      } ${displayMode.compactMode ? 'space-y-2' : 'space-y-3'}`}
                    >
                      {/* 时间戳和说话人信息 */}
                      {(displayMode.showTimestamps || displayMode.showSpeakers) && (
                        <div className={`flex items-center gap-3 text-xs ${displayMode.darkMode ? 'text-gray-400' : 'text-muted-foreground'}`}>
                          {displayMode.showTimestamps && (
                            <span>{new Date(segment.timestamp).toLocaleTimeString()}</span>
                          )}
                          {displayMode.showSpeakers && segment.speaker && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                segment.speaker === 'interviewer' 
                                  ? `${displayMode.darkMode ? 'bg-purple-900 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-600 border-purple-200'}` 
                                  : `${displayMode.darkMode ? 'bg-blue-900 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-600 border-blue-200'}`
                              }`}
                            >
                              {segment.speaker === 'interviewer' ? '面试官' : '候选人'}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {/* 英文原文 */}
                      {displayMode.showEnglish && segment.englishText && (
                        <div className={`${getTextSizeClass()} ${getLineHeightClass()} ${
                          displayMode.darkMode ? 'text-gray-300' : 'text-gray-800'
                        } font-medium opacity-80 ${displayMode.compactMode ? 'text-sm' : ''}`}>
                          {segment.englishText}
                        </div>
                      )}
                      
                      {/* 中文翻译 - 主要内容 */}
                      {segment.chineseText && (
                        <div className={`${getTextSizeClass()} ${getLineHeightClass()} ${
                          displayMode.darkMode ? 'text-white' : 'text-gray-900'
                        } font-medium pl-4 border-l-4 ${
                          displayMode.darkMode ? 'border-blue-400' : 'border-blue-400'
                        } ${displayMode.compactMode ? 'pl-2 border-l-2' : 'pl-4 border-l-4'}`}>
                          {segment.chineseText}
                        </div>
                      )}
                      
                      {/* 等待翻译指示器 */}
                      {segment.englishText && !segment.chineseText && (
                        <div className={`text-sm ${displayMode.darkMode ? 'text-amber-400' : 'text-amber-600'} flex items-center gap-2 pl-4`}>
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span>翻译中...</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 当前处理中的文本 */}
                {isActive && (currentText || isProcessing) && (
                  <div className={`${displayMode.darkMode ? 'bg-gray-800' : 'bg-gray-50'} p-4 rounded-lg border-2 border-dashed ${displayMode.darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                    {currentText && (
                      <div className={`${getTextSizeClass()} ${getLineHeightClass()} ${displayMode.darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                        {currentText}
                        <span className="text-blue-500 animate-pulse ml-2">●</span>
                      </div>
                    )}
                    
                    {currentTranslation && (
                      <div className={`${getTextSizeClass()} ${getLineHeightClass()} ${displayMode.darkMode ? 'text-white' : 'text-gray-900'} font-medium pl-4 border-l-4 ${displayMode.darkMode ? 'border-blue-400' : 'border-blue-400'}`}>
                        {currentTranslation}
                        <span className="text-green-500 animate-pulse ml-2">●</span>
                      </div>
                    )}

                    {isProcessing && !currentTranslation && (
                      <div className={`text-sm ${displayMode.darkMode ? 'text-amber-400' : 'text-amber-600'} flex items-center gap-2`}>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                        <span>正在处理...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部悬浮状态栏 */}
      {isActive && (
        <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50`}>
          <div className={`${displayMode.darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-2xl shadow-xl border backdrop-blur-sm px-4 py-3`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isPaused ? 'bg-orange-500' : 'bg-green-500 animate-pulse'
                }`}></div>
                <span className={`font-mono font-medium ${displayMode.darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              <div className={`text-xs ${displayMode.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {isPaused ? '已暂停' : isProcessing ? '处理中' : '录制中'}
              </div>
              
              <div className="h-4 w-px bg-gray-300"></div>
              
              <div className={`text-xs ${displayMode.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {storeSegments.filter(s => s.chineseText).length} 段翻译
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TranslationFocusedInterview;