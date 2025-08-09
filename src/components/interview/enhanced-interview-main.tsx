// 增强版面试主界面 - 优化用户体验

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Mic, 
  Loader, 
  Square,
  Clock,
  User,
  Briefcase,
  Pause,
  Play
} from 'lucide-react';
import { useWAVStreamingStore } from '@/store/wav-streaming-store';

export function EnhancedInterviewMain() {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [interviewSummary, setInterviewSummary] = useState<any>(null);
  const [completedSegments, setCompletedSegments] = useState<any[]>([]);
  const [candidateName, setCandidateName] = useState('');
  const [position, setPosition] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    isActive,
    isPaused,
    isProcessing,
    currentText,
    currentTranslation,
    segments: storeSegments,
    completedSegments: storeCompletedSegments,
    interviewInfo,
    interviewSummary: storeInterviewSummary,
    isGeneratingSummary: storeIsGeneratingSummary,
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

  // 同步store状态到本地状态
  useEffect(() => {
    setCompletedSegments(storeCompletedSegments);
    setInterviewSummary(storeInterviewSummary);
    setIsGeneratingSummary(storeIsGeneratingSummary);
  }, [storeCompletedSegments, storeInterviewSummary, storeIsGeneratingSummary]);

  // 录制时间计时器 - 修复暂停时计时器问题
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

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
      
      // 传递面试信息到store
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
      // 先保存当前会话的所有分段到完成状态
      const allSegments = currentText && currentTranslation
        ? [
            ...storeSegments,
            {
              id: `final-segment-${Date.now()}`,
              timestamp: new Date(),
              englishText: currentText,
              chineseText: currentTranslation,
              speaker: 'candidate',
              confidence: 0.9,
              wordCount: currentText.split(' ').length,
              isComplete: true
            }
          ]
        : [...storeSegments];
      
      setCompletedSegments(allSegments);
      
      // 停止流式处理
      await stopStreaming();
      
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
        <div className="max-w-4xl mx-auto">
          {/* 面试信息输入区域 */}
          {!isActive && completedSegments.length === 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="candidateName" className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" />
                    应聘人姓名
                  </Label>
                  <Input
                    id="candidateName"
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position" className="flex items-center gap-2 text-sm font-medium">
                    <Briefcase className="h-4 w-4" />
                    面试岗位
                  </Label>
                  <select
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">请选择岗位</option>
                    <option value="product_manager_software">产品经理（软件）</option>
                    <option value="product_manager_hardware">产品经理（硬件）</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {/* 面试状态和控制区域 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">面试转录</h2>
              {/* 显示当前面试信息 */}
              {(isActive || completedSegments.length > 0) && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {candidateName || 'unknown'}
                  </span>
                  {position && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {position}
                    </span>
                  )}
                </div>
              )}
              {isActive && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
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
                  开始面试
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
                <div className="flex items-center gap-3">
                  {!isPaused ? (
                    <Button 
                      onClick={pauseStreaming}
                      size="lg"
                      variant="outline"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      暂停
                    </Button>
                  ) : (
                    <Button 
                      onClick={resumeStreaming}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      继续
                    </Button>
                  )}
                  
                  <Button 
                    onClick={handleStopRecording}
                    size="lg"
                    variant="destructive"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    结束面试
                  </Button>
                </div>
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
      </div>

      {/* 转录内容显示 - 修复显示问题 */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={scrollContainerRef}
          className="h-full overflow-y-auto px-4 py-6"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {/* 增强版面试总结显示 */}
            {interviewSummary && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  🤖 智能面试总结
                  <span className="text-sm text-blue-600 font-normal">
                    ({Math.floor(recordingTime / 60)}分钟面试)
                  </span>
                  {interviewSummary.positionAssessment && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      岗位匹配分析
                    </span>
                  )}
                </h3>
                
                <div className="space-y-6">
                  {/* 执行摘要 */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      📄 整体评估
                    </h4>
                    <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded">
                      {interviewSummary.executiveSummary}
                    </p>
                  </div>
                  
                  {/* V2.0新增：岗位匹配评估 */}
                  {interviewSummary.positionAssessment && (
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
                        🎯 岗位匹配度分析
                        <span className="text-sm font-normal text-gray-600">
                          (基于{interviewSummary.positionAssessment.templateInfo.name})
                        </span>
                      </h4>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        {/* 综合匹配度 */}
                        <div className="text-center p-3 bg-purple-50 rounded">
                          <div className="text-2xl font-bold text-purple-700">
                            {interviewSummary.positionAssessment.overallFit.score}分
                          </div>
                          <div className="text-sm text-purple-600">综合匹配度</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {interviewSummary.positionAssessment.overallFit.level === 'excellent' && '非常匹配'}
                            {interviewSummary.positionAssessment.overallFit.level === 'good' && '匹配较好'}
                            {interviewSummary.positionAssessment.overallFit.level === 'fair' && '基本匹配'}
                            {interviewSummary.positionAssessment.overallFit.level === 'poor' && '匹配度低'}
                          </div>
                        </div>
                        
                        {/* 技能匹配 */}
                        <div className="text-center p-3 bg-green-50 rounded">
                          <div className="text-2xl font-bold text-green-700">
                            {Math.round(interviewSummary.positionAssessment.skillsMatching.matchingScore)}%
                          </div>
                          <div className="text-sm text-green-600">技能匹配度</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {interviewSummary.positionAssessment.skillsMatching.demonstratedSkills.length}/
                            {interviewSummary.positionAssessment.skillsMatching.requiredSkills.length} 项技能
                          </div>
                        </div>
                        
                        {/* 推荐级别 */}
                        <div className="text-center p-3 bg-blue-50 rounded">
                          <div className="text-lg font-bold text-blue-700">
                            {interviewSummary.positionAssessment.recommendationLevel === 'strongly_recommend' && '强烈推荐'}
                            {interviewSummary.positionAssessment.recommendationLevel === 'recommend' && '推荐'}
                            {interviewSummary.positionAssessment.recommendationLevel === 'conditional' && '有条件推荐'}
                            {interviewSummary.positionAssessment.recommendationLevel === 'not_recommend' && '不推荐'}
                            {interviewSummary.positionAssessment.recommendationLevel === 'strongly_not_recommend' && '强烈不推荐'}
                          </div>
                          <div className="text-sm text-blue-600">推荐级别</div>
                        </div>
                      </div>
                      
                      {/* 维度评估简要展示 */}
                      {interviewSummary.positionAssessment.dimensionAssessments && 
                       interviewSummary.positionAssessment.dimensionAssessments.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-800 mb-2">评估维度表现</h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {interviewSummary.positionAssessment.dimensionAssessments.slice(0, 6).map((dim: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                <span className="text-gray-700">{dim.name}</span>
                                <span className={`font-medium ${
                                  dim.score >= 8 ? 'text-green-600' :
                                  dim.score >= 6 ? 'text-blue-600' :
                                  dim.score >= 4 ? 'text-orange-600' : 'text-red-600'
                                }`}>
                                  {dim.score}/10
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 通用评估（兼容性）*/}
                  {interviewSummary.generalAssessment && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-green-700 mb-2 flex items-center gap-1">
                          ✅ 优势表现
                        </h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {interviewSummary.generalAssessment.strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-500 mt-1">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-orange-700 mb-2 flex items-center gap-1">
                          🔄 待改进领域
                        </h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {interviewSummary.generalAssessment.weaknesses?.map((weakness: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-orange-500 mt-1">•</span>
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* 兼容原有格式 */}
                  {interviewSummary.candidatePerformance && !interviewSummary.generalAssessment && (
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
                  
                  {/* 推荐决策 */}
                  {interviewSummary.recommendation && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        📝 推荐决策
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          interviewSummary.recommendation.decision === 'strongly_recommend' ? 'bg-green-100 text-green-700' :
                          interviewSummary.recommendation.decision === 'recommend' ? 'bg-blue-100 text-blue-700' :
                          interviewSummary.recommendation.decision === 'neutral' ? 'bg-gray-100 text-gray-700' :
                          interviewSummary.recommendation.decision === 'not_recommend' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {interviewSummary.recommendation.decision === 'strongly_recommend' && '强烈推荐'}
                          {interviewSummary.recommendation.decision === 'recommend' && '推荐'}
                          {interviewSummary.recommendation.decision === 'neutral' && '中性'}
                          {interviewSummary.recommendation.decision === 'not_recommend' && '不推荐'}
                          {interviewSummary.recommendation.decision === 'strongly_not_recommend' && '强烈不推荐'}
                        </span>
                      </h4>
                      <p className="text-gray-700 leading-relaxed">{interviewSummary.recommendation.reasoning}</p>
                      {interviewSummary.recommendation.nextSteps && interviewSummary.recommendation.nextSteps.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-800 mb-1">后续步骤：</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {interviewSummary.recommendation.nextSteps.map((step: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-1">▶</span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 处理统计信息 */}
                  {interviewSummary.processingStats && (
                    <div className="text-xs text-gray-500 border-t pt-2 flex items-center justify-between">
                      <span>
                        分段数: {interviewSummary.processingStats.chunksProcessed || 0} | 
                        处理时间: {Math.round((interviewSummary.processingStats.processingTimeMs || 0) / 1000)}s | 
                        置信度: {Math.round((interviewSummary.processingStats.confidenceScore || 0) * 100)}%
                      </span>
                      {interviewSummary.processingStats.templateUsed && (
                        <span className="text-purple-600">✓ 使用了岗位模板</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* 流式显示所有分段 - 包括完成的和进行中的 */}
            <div className="space-y-6">
              {(isActive ? storeSegments : completedSegments).map((segment: any, index: number) => {
                // 判断是否为临时段落（正在处理中）
                const isTemporary = segment.isTemporary;
                const isTranscribing = segment.isTranscribing;
                const isTranslating = segment.isTranslating;
                
                return (
                  <div key={segment.id} className={`space-y-2 transition-all duration-300 ${
                    isTemporary ? 'bg-amber-50/30 p-3 rounded-lg border border-amber-200' : ''
                  }`}>
                    {/* 时间戳和说话人标识 - 简洁显示 */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(segment.timestamp).toLocaleTimeString()}</span>
                      {segment.speaker && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          segment.speaker === 'interviewer' 
                            ? 'bg-purple-100 text-purple-600' 
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {segment.speaker === 'interviewer' ? '面试官' : '候选人'}
                        </span>
                      )}
                      {/* 实时状态指示 */}
                      {isTemporary && (
                        <div className="flex items-center gap-2 text-xs text-amber-600">
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce"></div>
                            <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span className="font-medium">
                            {isTranscribing ? '转录中' : isTranslating ? '翻译中' : '处理中'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* 英文原文 */}
                    {segment.englishText && (
                      <div className={`text-base leading-relaxed font-medium ${
                        isTemporary ? 'text-amber-900' : 'text-gray-900'
                      }`}>
                        {segment.englishText}
                        {isTranscribing && <span className="text-amber-600 animate-pulse ml-1">●</span>}
                      </div>
                    )}
                    
                    {/* 中文翻译 */}
                    {segment.chineseText && (
                      <div className={`text-base leading-relaxed pl-4 border-l-2 ${
                        isTemporary 
                          ? 'text-amber-800 border-amber-300' 
                          : 'text-gray-700 border-gray-200'
                      }`}>
                        {segment.chineseText}
                        {isTranslating && <span className="text-amber-600 animate-pulse ml-1">●</span>}
                      </div>
                    )}
                    
                    {/* 等待翻译状态 */}
                    {isTemporary && segment.englishText && !segment.chineseText && (
                      <div className="text-xs text-amber-600 flex items-center gap-2 pl-4">
                        <Loader className="w-3 h-3 animate-spin" />
                        <span>正在翻译...</span>
                      </div>
                    )}
                    
                    {/* 分段间隔 */}
                    {index < (isActive ? storeSegments : completedSegments).length - 1 && (
                      <div className="h-4"></div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* 等待状态 */}
            {!isActive && storeSegments.length === 0 && (
              <div className="text-center py-12">
                <Mic className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  准备开始面试转录
                </h3>
                <p className="text-gray-500 mb-6">
                  点击&ldquo;开始面试&rdquo;按钮开始实时语音转录和翻译
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

      {/* 悬浮控制面板 - 解决滑动时不可见问题 */}
      {isActive && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-3 backdrop-blur-sm bg-white/95">
            <div className="flex items-center gap-3">
              {/* 录制状态指示 */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isPaused ? 'bg-orange-500' : 'bg-red-500 animate-pulse'
                }`}></div>
                <span className="text-sm font-mono font-medium text-gray-800">
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              <div className="h-4 w-px bg-gray-300"></div>
              
              {/* 控制按钮 */}
              <div className="flex items-center gap-2">
                {!isPaused ? (
                  <Button 
                    onClick={pauseStreaming}
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 border-orange-300 text-orange-600 hover:bg-orange-50 rounded-full"
                    title="暂停面试"
                  >
                    <Pause className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button 
                    onClick={resumeStreaming}
                    size="sm"
                    className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 rounded-full"
                    title="继续面试"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                )}
                
                <Button 
                  onClick={handleStopRecording}
                  size="sm"
                  variant="destructive"
                  className="h-8 w-8 p-0 rounded-full"
                  title="结束面试"
                >
                  <Square className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* 悬浮状态文字 */}
            {isPaused && (
              <div className="text-xs text-orange-600 text-center mt-1 font-medium">
                已暂停
              </div>
            )}
            
            {isGeneratingSummary && (
              <div className="text-xs text-blue-600 text-center mt-1 font-medium">
                正在生成总结...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedInterviewMain;