// 面试状态管理 - 使用Zustand

import React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { 
  InterviewSession, 
  TranscriptionSegment, 
  QuestionSuggestion,
  AppError 
} from '@/types';
import { 
  getStorageService, 
  getAudioService, 
  getTranslationService 
} from '@/services';

interface InterviewState {
  // 当前面试状态
  currentSession: InterviewSession | null;
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  
  // 转录和翻译状态
  segments: TranscriptionSegment[];
  isProcessingAudio: boolean;
  isTranslating: boolean;
  
  // 当前活跃的对话段落 - 用于实时更新显示
  activeSegment: {
    id: string;
    fragments: string[]; // 收集的文本碎片
    mergedText: string; // 合并后的当前显示文本
    translatedText: string; // 当前翻译文本
    confidence: number;
    startTime: number;
    lastUpdateTime: number;
    lastFragmentTime: number; // 最后一个碎片的时间
    isTranslating: boolean;
  } | null;
  
  // 碎片处理状态
  fragmentProcessing: {
    lastProcessedAudioSize: number; // 跟踪音频大小而非块数
    silenceStartTime: number;
    isInSilence: boolean;
  };
  
  // 问题建议
  questionSuggestions: QuestionSuggestion[];
  isLoadingSuggestions: boolean;
  
  // 历史记录
  sessions: InterviewSession[];
  
  // 错误处理
  error: AppError | null;
  
  // 配置
  config: {
    openaiApiKey: string;
    autoTranslate: boolean;
    autoSuggestQuestions: boolean;
    language: {
      source: 'en' | 'zh';
      target: 'en' | 'zh';
    };
  };
}

interface InterviewActions {
  // 面试会话管理
  startInterview: (candidateName: string, position: string) => Promise<void>;
  pauseInterview: () => Promise<void>;
  resumeInterview: () => Promise<void>;
  stopInterview: () => Promise<void>;
  
  // 录音控制
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  
  // 音频处理
  processAudioChunk: (audioBlob: Blob) => Promise<void>;
  addSegment: (segment: Omit<TranscriptionSegment, 'id'>) => void;
  
  // 碎片处理核心方法
  processTextFragment: (text: string, confidence: number, audioSize: number) => void;
  updateActiveSegmentDisplay: () => void;
  finalizeActiveSegment: () => void;
  checkSilenceAndFinalize: () => void;
  
  // 碎片合并和清理
  mergeFragments: (fragments: string[]) => string;
  extractNewFragment: (newText: string, existingFragments: string[]) => string;
  calculateTextSimilarity: (text1: string, text2: string) => number;
  findTextDifference: (oldText: string, newText: string) => string;
  
  // 实时翻译
  translateActiveSegment: () => Promise<void>;
  
  // 辅助处理方法
  transcribeAudio: (audioBlob: Blob) => Promise<any>;
  createSegment: (transcriptionResult: any) => Omit<TranscriptionSegment, 'id'>;
  processSegmentPostActions: (segmentId: string) => Promise<void>;
  handleAudioProcessingError: (error: unknown) => void;
  shouldFinalizeSpeech: (newText: string) => boolean;
  mergeTranscriptionTexts: (oldText: string, newText: string) => string;
  isTextComplete: (text: string) => boolean;
  isTextSubstantiallyEqual: (text1: string, text2: string) => boolean;
  extractNewContent: (text: string, existingSegments: TranscriptionSegment[]) => string;
  
  // 翻译
  translateSegment: (segmentId: string) => Promise<void>;
  
  // 问题建议
  loadQuestionSuggestions: () => Promise<void>;
  
  // 数据管理
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  
  // 配置管理
  updateConfig: (config: Partial<InterviewState['config']>) => void;
  
  // 错误处理
  setError: (error: AppError | null) => void;
  clearError: () => void;
  
  // 重置状态
  reset: () => void;
}

type InterviewStore = InterviewState & InterviewActions;

const initialState: InterviewState = {
  currentSession: null,
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  segments: [],
  isProcessingAudio: false,
  isTranslating: false,
  activeSegment: null,
  fragmentProcessing: {
    lastProcessedAudioSize: 0,
    silenceStartTime: 0,
    isInSilence: false
  },
  questionSuggestions: [],
  isLoadingSuggestions: false,
  sessions: [],
  error: null,
  config: {
    openaiApiKey: '',
    autoTranslate: true,
    autoSuggestQuestions: true,
    language: {
      source: 'en',
      target: 'zh'
    }
  }
};

export const useInterviewStore = create<InterviewStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 面试会话管理
      startInterview: async (candidateName: string, position: string) => {
        try {
          const session: InterviewSession = {
            id: `interview-${Date.now()}`,
            candidateName,
            position,
            startTime: new Date(),
            status: 'recording',
            segments: []
          };

          await getStorageService().saveInterview(session);
          
          set({ 
            currentSession: session,
            segments: [],
            error: null 
          });
        } catch (error) {
          get().setError({
            code: 'START_INTERVIEW_FAILED',
            message: '开始面试失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      pauseInterview: async () => {
        try {
          const { currentSession } = get();
          if (!currentSession) return;

          const updatedSession = {
            ...currentSession,
            status: 'paused' as const
          };

          await getStorageService().updateInterview(
            currentSession.id, 
            { status: 'paused' }
          );
          
          if (typeof window !== 'undefined') {
            await getAudioService().pauseRecording();
          }
          
          set({ 
            currentSession: updatedSession,
            isPaused: true 
          });
        } catch (error) {
          get().setError({
            code: 'PAUSE_INTERVIEW_FAILED',
            message: '暂停面试失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      resumeInterview: async () => {
        try {
          const { currentSession } = get();
          if (!currentSession) return;

          const updatedSession = {
            ...currentSession,
            status: 'recording' as const
          };

          await getStorageService().updateInterview(
            currentSession.id, 
            { status: 'recording' }
          );
          
          if (typeof window !== 'undefined') {
            await getAudioService().resumeRecording();
          }
          
          set({ 
            currentSession: updatedSession,
            isPaused: false 
          });
        } catch (error) {
          get().setError({
            code: 'RESUME_INTERVIEW_FAILED',
            message: '恢复面试失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      stopInterview: async () => {
        try {
          const { currentSession, segments } = get();
          if (!currentSession) return;

          const updatedSession = {
            ...currentSession,
            status: 'completed' as const,
            endTime: new Date(),
            segments
          };

          await getStorageService().updateInterview(
            currentSession.id, 
            updatedSession
          );
          
          if (get().isRecording && typeof window !== 'undefined') {
            await getAudioService().stopRecording();
          }
          
          set({ 
            currentSession: updatedSession,
            isRecording: false,
            isPaused: false,
            recordingDuration: 0
          });

          // 刷新会话列表
          await get().loadSessions();
        } catch (error) {
          get().setError({
            code: 'STOP_INTERVIEW_FAILED',
            message: '结束面试失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      // 录音控制
      startRecording: async () => {
        try {
          // 确保在客户端执行
          if (typeof window === 'undefined') {
            throw new Error('Recording not available during SSR');
          }
          
          const audioService = getAudioService();
          
          await audioService.startRecording({
            sampleRate: 44100,
            channels: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          });

          set({ isRecording: true, error: null });

          // 启动录音时长更新定时器
          const updateDuration = () => {
            if (get().isRecording) {
              set({ recordingDuration: audioService.getRecordingDuration() });
              setTimeout(updateDuration, 1000);
            }
          };
          updateDuration();

        } catch (error) {
          get().setError({
            code: 'START_RECORDING_FAILED',
            message: '开始录音失败，请检查麦克风权限',
            details: error,
            timestamp: new Date()
          });
        }
      },

      stopRecording: async () => {
        try {
          // 确保在客户端执行
          if (typeof window === 'undefined') {
            return;
          }
          
          await getAudioService().stopRecording();
          set({ 
            isRecording: false, 
            isPaused: false,
            recordingDuration: 0 
          });
        } catch (error) {
          get().setError({
            code: 'STOP_RECORDING_FAILED',
            message: '停止录音失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      // 音频处理 - 实现正确的碎片级处理
      processAudioChunk: async (audioBlob: Blob, metadata?: any) => {
        const actions = get();
        
        try {
          console.log('🎵 开始处理音频块:', {
            size: audioBlob.size,
            type: audioBlob.type,
            isIncremental: metadata?.isIncremental
          });
          
          set({ isProcessingAudio: true });
          
          // 检查是否有新的音频数据需要处理
          const { fragmentProcessing } = get();
          if (audioBlob.size <= fragmentProcessing.lastProcessedAudioSize) {
            console.log('⏭️ 音频大小未增加，跳过处理');
            set({ isProcessingAudio: false });
            return;
          }
          
          // 转录音频
          const transcriptionResult = await actions.transcribeAudio(audioBlob);
          if (!transcriptionResult.text.trim()) {
            console.log('📭 转录结果为空，检查静音状态');
            actions.checkSilenceAndFinalize();
            set({ isProcessingAudio: false });
            return;
          }

          console.log('📝 转录结果:', transcriptionResult.text);
          
          // 处理文本碎片
          actions.processTextFragment(
            transcriptionResult.text, 
            transcriptionResult.confidence,
            audioBlob.size
          );
          
          console.log('✅ 音频处理完成');
          set({ isProcessingAudio: false });
        } catch (error) {
          actions.handleAudioProcessingError(error);
        }
      },

      // 辅助方法
      transcribeAudio: async (audioBlob: Blob) => {
        // 确保在客户端执行
        if (typeof window === 'undefined') {
          throw new Error('Transcription not available during SSR');
        }
        
        const audioService = getAudioService();
        console.log('开始调用音频转录...');
        const result = await audioService.transcribe(audioBlob);
        console.log('转录完成，结果:', result);
        return result;
      },

      createSegment: (transcriptionResult: any) => {
        return {
          id: `segment-${Date.now()}`,
          timestamp: Date.now(),
          originalText: transcriptionResult.text,
          translatedText: '',
          speaker: 'candidate' as const,
          confidence: transcriptionResult.confidence,
          isProcessing: true
        };
      },

      processSegmentPostActions: async (segmentId: string) => {
        const { config } = get();
        
        // 自动翻译
        if (config.autoTranslate) {
          console.log('开始自动翻译...');
          await get().translateSegment(segmentId);
        } else {
          // 标记处理完成
          set(state => ({
            segments: state.segments.map(s => 
              s.id === segmentId ? { ...s, isProcessing: false } : s
            )
          }));
        }

        // 自动生成问题建议
        if (config.autoSuggestQuestions) {
          console.log('加载问题建议...');
          await get().loadQuestionSuggestions();
        }
      },

      handleAudioProcessingError: (error: unknown) => {
        console.error('音频处理失败:', error);
        set({ isProcessingAudio: false });
        
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        get().setError({
          code: 'PROCESS_AUDIO_FAILED',
          message: `音频处理失败: ${errorMessage}`,
          details: error,
          timestamp: new Date()
        });
      },

      addSegment: (segmentData) => {
        const segment: TranscriptionSegment = {
          ...segmentData,
          id: `segment-${Date.now()}`
        };

        set(state => ({
          segments: [...state.segments, segment]
        }));

        // 保存到当前会话
        const { currentSession } = get();
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            segments: [...get().segments]
          };
          getStorageService().updateInterview(currentSession.id, { segments: updatedSession.segments });
        }
      },

      // 翻译
      translateSegment: async (segmentId: string) => {
        try {
          // 确保在客户端执行
          if (typeof window === 'undefined') {
            throw new Error('Translation not available during SSR');
          }
          
          set({ isTranslating: true });
          
          const { segments, config } = get();
          const segment = segments.find(s => s.id === segmentId);
          
          if (!segment) return;

          const translationService = getTranslationService();
          const translationResult = await translationService.translate(
            segment.originalText,
            config.language.source,
            config.language.target
          );

          set(state => ({
            segments: state.segments.map(s =>
              s.id === segmentId
                ? { ...s, translatedText: translationResult.translatedText }
                : s
            ),
            isTranslating: false
          }));
        } catch (error) {
          set({ isTranslating: false });
          get().setError({
            code: 'TRANSLATION_FAILED',
            message: '翻译失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      // 问题建议
      loadQuestionSuggestions: async () => {
        try {
          // 确保在客户端执行
          if (typeof window === 'undefined') {
            throw new Error('Question suggestions not available during SSR');
          }
          
          set({ isLoadingSuggestions: true });
          
          const { segments } = get();
          const recentTexts = segments
            .slice(-5)
            .map(s => s.originalText);

          if (recentTexts.length === 0) {
            set({ 
              questionSuggestions: [],
              isLoadingSuggestions: false 
            });
            return;
          }

          const translationService = getTranslationService();
          const suggestions = await translationService.suggestQuestions(recentTexts);

          set({ 
            questionSuggestions: suggestions,
            isLoadingSuggestions: false 
          });
        } catch (error) {
          set({ isLoadingSuggestions: false });
          get().setError({
            code: 'LOAD_SUGGESTIONS_FAILED',
            message: '加载问题建议失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      // 数据管理
      loadSessions: async () => {
        try {
          const storageService = getStorageService();
          const sessions = await storageService.listInterviews(20, 0);
          set({ sessions });
        } catch (error) {
          get().setError({
            code: 'LOAD_SESSIONS_FAILED',
            message: '加载历史记录失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      deleteSession: async (sessionId: string) => {
        try {
          await getStorageService().deleteInterview(sessionId);
          await get().loadSessions();
        } catch (error) {
          get().setError({
            code: 'DELETE_SESSION_FAILED',
            message: '删除面试记录失败',
            details: error,
            timestamp: new Date()
          });
        }
      },

      // 配置管理
      updateConfig: (configUpdate) => {
        set(state => ({
          config: { ...state.config, ...configUpdate }
        }));
        
        // 保存到localStorage（延迟到客户端）
        setTimeout(() => {
          if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
            try {
              const newConfig = { ...get().config, ...configUpdate };
              localStorage.setItem('interview-assistant-config', JSON.stringify(newConfig));
            } catch (error) {
              console.warn('Failed to save config to localStorage:', error);
            }
          }
        }, 0);
      },

      // 碎片处理核心方法 - 简化版本
      processTextFragment: (text: string, confidence: number, audioSize: number) => {
        const { activeSegment, fragmentProcessing } = get();
        const now = Date.now();
        const trimmedText = text.trim();
        
        console.log('🎯 processTextFragment 输入:', {
          inputText: trimmedText,
          confidence,
          currentMergedText: activeSegment?.mergedText || '(空)'
        });
        
        // 使用简化的累积文本处理逻辑
        const currentMergedText = activeSegment?.mergedText || '';
        
        // 完全相同，无新内容
        if (trimmedText === currentMergedText) {
          console.log('⚠️ 文本完全重复，跳过');
          return;
        }
        
        // 新文本更短，可能是错误，跳过
        if (trimmedText.length < currentMergedText.length) {
          console.log('⚠️ 新文本更短，可能是错误');
          return;
        }
        
        let newMergedText = trimmedText;
        let isNewSegment = false;
        
        if (!activeSegment) {
          // 第一个段落
          isNewSegment = true;
          console.log('🆕 创建首个活跃段落:', trimmedText);
        } else if (trimmedText.startsWith(currentMergedText)) {
          // 累积文本，提取新增部分
          const newPart = trimmedText.slice(currentMergedText.length);
          console.log('✅ 检测到新增内容:', {
            currentText: currentMergedText.slice(-30) + '...',
            newPart: newPart || '(无新增)',
            fullText: trimmedText
          });
          newMergedText = trimmedText;
        } else {
          // 完全不同的新文本，可能是新句子开始
          console.log('🚀 检测到全新文本，开始新段落');
          // 先完成当前段落
          if (activeSegment) {
            get().finalizeActiveSegment();
          }
          isNewSegment = true;
        }
        
        if (isNewSegment) {
          // 创建新的活跃段落
          const segmentId = `segment-${now}`;
          set({
            activeSegment: {
              id: segmentId,
              fragments: [newMergedText],
              mergedText: newMergedText,
              translatedText: '',
              confidence,
              startTime: now,
              lastUpdateTime: now,
              lastFragmentTime: now,
              isTranslating: false
            },
            fragmentProcessing: {
              ...fragmentProcessing,
              lastProcessedAudioSize: audioSize,
              silenceStartTime: now,
              isInSilence: false
            }
          });
        } else {
          // 更新现有活跃段落
          set({
            activeSegment: {
              id: activeSegment!.id,
              fragments: [...activeSegment!.fragments, newMergedText],
              mergedText: newMergedText,
              translatedText: activeSegment!.translatedText,
              confidence: Math.max(activeSegment!.confidence, confidence),
              startTime: activeSegment!.startTime,
              lastUpdateTime: now,
              lastFragmentTime: now,
              isTranslating: activeSegment!.isTranslating
            },
            fragmentProcessing: {
              ...fragmentProcessing,
              lastProcessedAudioSize: audioSize,
              silenceStartTime: now,
              isInSilence: false
            }
          });
        }
        
        console.log('🔄 段落更新完成:', newMergedText);
        
        // 立即更新显示和翻译
        get().updateActiveSegmentDisplay();
        
        // 检查是否需要分段
        get().checkSilenceAndFinalize();
      },

      updateActiveSegmentDisplay: () => {
        const { activeSegment, config } = get();
        if (!activeSegment) return;
        
        console.log('🖼️ 更新显示:', activeSegment.mergedText);
        
        // 如果启用自动翻译且当前没在翻译
        if (config.autoTranslate && !activeSegment.isTranslating) {
          get().translateActiveSegment();
        }
      },

      checkSilenceAndFinalize: () => {
        const { activeSegment, fragmentProcessing } = get();
        if (!activeSegment) return;
        
        const now = Date.now();
        const silenceDuration = now - activeSegment.lastFragmentTime;
        const textLength = activeSegment.mergedText.length;
        
        // 判断分段条件
        const hasLongSilence = silenceDuration > 2000; // 2秒静音
        const hasEndPunctuation = /[.!?。！？]$/.test(activeSegment.mergedText.trim());
        const hasLongText = textLength > 100; // 长文本自动分段
        const seemsComplete = get().isTextComplete(activeSegment.mergedText);
        
        if ((hasLongSilence && seemsComplete) || hasEndPunctuation || hasLongText) {
          console.log('🏁 检测到分段条件，完成当前段落');
          get().finalizeActiveSegment();
        }
      },

      finalizeActiveSegment: () => {
        const { activeSegment } = get();
        if (!activeSegment || activeSegment.mergedText.trim().length === 0) {
          set({ activeSegment: null });
          return;
        }
        
        console.log('✅ 完成段落:', activeSegment.mergedText);
        
        // 创建最终的转录段
        const segment: TranscriptionSegment = {
          id: activeSegment.id,
          timestamp: activeSegment.startTime,
          originalText: activeSegment.mergedText,
          translatedText: activeSegment.translatedText,
          speaker: 'candidate',
          confidence: activeSegment.confidence,
          isProcessing: false
        };
        
        // 添加到segments列表
        set(state => ({
          segments: [...state.segments, segment],
          activeSegment: null // 清空活跃段落，准备下一个
        }));
        
        // 如果还没有翻译，异步完成翻译
        if (!segment.translatedText) {
          get().translateSegment(segment.id);
        }
        
        // 生成问题建议
        if (get().config.autoSuggestQuestions) {
          get().loadQuestionSuggestions();
        }
      },

      // 实时翻译活跃段落
      translateActiveSegment: async () => {
        const { activeSegment } = get();
        if (!activeSegment || activeSegment.isTranslating || activeSegment.mergedText.trim().length < 3) {
          return;
        }
        
        // 标记为翻译中
        set(state => state.activeSegment ? {
          activeSegment: { ...state.activeSegment, isTranslating: true }
        } : {});
        
        try {
          console.log('🌍 开始翻译活跃段落:', activeSegment.mergedText);
          
          const translationService = getTranslationService();
          const result = await translationService.translate(
            activeSegment.mergedText,
            'en',
            'zh'
          );
          
          // 更新翻译结果
          set(state => state.activeSegment ? {
            activeSegment: {
              ...state.activeSegment,
              translatedText: result.translatedText,
              isTranslating: false
            }
          } : {});
          
          console.log('✅ 翻译完成:', result.translatedText);
        } catch (error) {
          console.error('❌ 翻译失败:', error);
          set(state => state.activeSegment ? {
            activeSegment: { ...state.activeSegment, isTranslating: false }
          } : {});
        }
      },

      // 错误处理
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // 保留这个方法但不实现，用于兼容性
      updateCurrentSpeech: (text: string, confidence: number, metadata?: any) => {
        console.log('updateCurrentSpeech called but not implemented in new architecture');
      },

      // 简化的兼容性方法
      finalizeCurrentSpeech: () => {
        console.log('finalizeCurrentSpeech called but not implemented in new architecture');
      },

      // 简化的兼容性方法
      resetCurrentSpeech: () => {
        console.log('resetCurrentSpeech called but not implemented in new architecture');
      },

      detectSilenceAndFinalize: () => {
        console.log('detectSilenceAndFinalize called but not implemented in new architecture');
      },

      performDelayedMerge: () => {
        console.log('performDelayedMerge called but not implemented in new architecture');
      },

      findMergeCandidates: (segments: TranscriptionSegment[]) => {
        return [];
      },

      areSegmentsRelated: (text1: string, text2: string) => {
        return false;
      },

      mergeSegments: (segments: TranscriptionSegment[]) => {
        console.log('mergeSegments called but not implemented in new architecture');
      },

      // 简化的兼容性方法
      shouldFinalizeSpeech: (newText: string) => {
        return false;
      },

      isTextComplete: (text: string) => {
        const words = text.trim().split(/\s+/);
        return words.length >= 3;
      },

      isTextSubstantiallyEqual: (text1: string, text2: string) => {
        return text1.trim().toLowerCase() === text2.trim().toLowerCase();
      },

      extractNewContent: (text: string, existingSegments: TranscriptionSegment[]) => {
        return text.trim();
      },

      // 简化的兼容性方法
      mergeFragments: (fragments: string[]) => {
        return fragments.join(' ').trim();
      },

      extractNewFragment: (newText: string, existingFragments: string[]) => {
        return newText.trim();
      },

      calculateTextSimilarity: (text1: string, text2: string) => {
        return text1 === text2 ? 1 : 0;
      },

      findTextDifference: (oldText: string, newText: string) => {
        return newText;
      },

      mergeTranscriptionTexts: (oldText: string, newText: string) => {
        return newText.length > oldText.length ? newText : oldText;
      },

      // 重置状态
      reset: () => set(initialState)
    }),
    {
      name: 'interview-store',
    }
  )
);

// 客户端配置初始化Hook
export const useInitializeConfig = () => {
  const updateConfig = useInterviewStore(state => state.updateConfig);
  
  React.useEffect(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedConfig = localStorage.getItem('interview-assistant-config');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          updateConfig(config);
        }
      } catch (error) {
        console.warn('Failed to load saved config:', error);
      }
    }
  }, [updateConfig]);
};