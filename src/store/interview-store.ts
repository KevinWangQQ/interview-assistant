// 面试状态管理 - 使用Zustand

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
          
          await getAudioService().pauseRecording();
          
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
          
          await getAudioService().resumeRecording();
          
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
          
          if (get().isRecording) {
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

      // 音频处理
      processAudioChunk: async (audioBlob: Blob) => {
        try {
          console.log('开始处理音频块，大小:', audioBlob.size, '类型:', audioBlob.type);
          set({ isProcessingAudio: true });
          
          const audioService = getAudioService();
          const translationService = getTranslationService();
          
          console.log('音频服务实例:', audioService.constructor.name);
          console.log('翻译服务实例:', translationService.constructor.name);
          
          // 转录音频
          console.log('开始调用音频转录...');
          const transcriptionResult = await audioService.transcribe(audioBlob);
          console.log('转录完成，结果:', transcriptionResult);
          
          if (!transcriptionResult.text.trim()) {
            console.log('转录结果为空，跳过处理');
            set({ isProcessingAudio: false });
            return;
          }

          // 创建新的转录段
          const segment: TranscriptionSegment = {
            id: `segment-${Date.now()}`,
            timestamp: Date.now(),
            originalText: transcriptionResult.text,
            translatedText: '',
            speaker: 'candidate', // 默认为候选人，可以后续优化识别说话人
            confidence: transcriptionResult.confidence,
            isProcessing: true
          };

          console.log('添加新转录段:', segment);
          get().addSegment(segment);

          // 自动翻译
          if (get().config.autoTranslate) {
            console.log('开始自动翻译...');
            const { source, target } = get().config.language;
            const translationResult = await translationService.translate(
              segment.originalText, 
              source, 
              target
            );
            console.log('翻译完成:', translationResult);

            // 更新翻译结果
            set(state => ({
              segments: state.segments.map(s => 
                s.id === segment.id 
                  ? { ...s, translatedText: translationResult.translatedText, isProcessing: false }
                  : s
              )
            }));
          } else {
            // 标记处理完成
            set(state => ({
              segments: state.segments.map(s => 
                s.id === segment.id 
                  ? { ...s, isProcessing: false }
                  : s
              )
            }));
          }

          // 自动生成问题建议
          if (get().config.autoSuggestQuestions) {
            console.log('加载问题建议...');
            await get().loadQuestionSuggestions();
          }

          console.log('音频处理完成');
          set({ isProcessingAudio: false });
        } catch (error) {
          console.error('音频处理详细错误信息:', error);
          console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
          set({ isProcessingAudio: false });
          
          // 错误恢复：不阻止后续音频处理
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          console.warn('音频处理失败，但继续录音:', errorMessage);
          
          get().setError({
            code: 'PROCESS_AUDIO_FAILED',
            message: `音频处理失败: ${errorMessage}`,
            details: error,
            timestamp: new Date()
          });
          
          // 3秒后自动清除错误，允许用户继续
          setTimeout(() => {
            get().clearError();
          }, 3000);
        }
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
        
        // 保存到localStorage（仅在客户端）
        if (typeof window !== 'undefined') {
          const newConfig = { ...get().config, ...configUpdate };
          localStorage.setItem('interview-assistant-config', JSON.stringify(newConfig));
        }
      },

      // 错误处理
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // 重置状态
      reset: () => set(initialState)
    }),
    {
      name: 'interview-store',
    }
  )
);

// 初始化配置（仅在客户端）
if (typeof window !== 'undefined') {
  const savedConfig = localStorage.getItem('interview-assistant-config');
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      useInterviewStore.getState().updateConfig(config);
    } catch (error) {
      console.warn('Failed to load saved config:', error);
    }
  }
}