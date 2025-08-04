// 🎵 WAV流式Store - 使用WAV格式确保Whisper兼容

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { EnhancedWAVStreamingTranscriptionService } from '@/services/streaming/enhanced-wav-streaming-transcription';

interface WAVStreamingState {
  isActive: boolean;
  isProcessing: boolean;
  currentText: string;
  currentTranslation: string;
  segments: any[];
  streamingService: EnhancedWAVStreamingTranscriptionService | null;
  error: string | null;
  config: {
    chunkInterval: number;
    translationDelay: number;
  };
}

interface WAVStreamingActions {
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  generateSummaryAndSave: () => Promise<void>;
  handleTranscriptionUpdate: (data: any) => void;
  handleTranslationUpdate: (data: any) => void;
  handleSegmentCreated: (data: any) => void;
  handleError: (data: any) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

type WAVStreamingStore = WAVStreamingState & WAVStreamingActions;

const initialState: WAVStreamingState = {
  isActive: false,
  isProcessing: false,
  currentText: '',
  currentTranslation: '',
  segments: [],
  streamingService: null,
  error: null,
  config: {
    chunkInterval: 3000,
    translationDelay: 1000
  }
};

export const useWAVStreamingStore = create<WAVStreamingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startStreaming: async () => {
        try {
          console.log('🎵 启动WAV流式处理');
          
          const { config } = get();
          
          const streamingService = new EnhancedWAVStreamingTranscriptionService({
            chunkInterval: config.chunkInterval,
            translationDelay: config.translationDelay,
            enableSystemAudio: true,
            audioQualityThreshold: 0.1
          });

          streamingService.addEventListener('transcription_update', (event) => {
            get().handleTranscriptionUpdate(event.data);
          });

          streamingService.addEventListener('translation_update', (event) => {
            get().handleTranslationUpdate(event.data);
          });

          streamingService.addEventListener('segment_created', (event) => {
            get().handleSegmentCreated(event.data);
          });

          streamingService.addEventListener('error', (event) => {
            get().handleError(event.data);
          });

          await streamingService.startStreaming();
          
          set({ 
            streamingService,
            isActive: true,
            isProcessing: true,
            error: null
          });
          
          console.log('✅ WAV流式处理启动成功');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '启动失败';
          console.error('❌ 启动WAV流式处理失败:', error);
          get().setError(`启动失败: ${errorMessage}`);
        }
      },

      stopStreaming: async () => {
        try {
          const { streamingService } = get();
          if (streamingService) {
            await streamingService.stopStreaming();
          }
          
          set({ 
            streamingService: null,
            isActive: false,
            isProcessing: false,
            segments: [],
            currentText: '',
            currentTranslation: '',
            error: null
          });
          
          console.log('✅ WAV流式处理已停止');
        } catch (error) {
          console.error('❌ 停止WAV流式处理失败:', error);
        }
      },

      handleTranscriptionUpdate: (data: any) => {
        console.log('📝 WAV转录更新:', data.text);
        set({
          currentText: data.text,
          isProcessing: true
        });
      },

      handleTranslationUpdate: (data: any) => {
        console.log('🌍 WAV翻译更新:', data.translation);
        set({
          currentText: data.text,
          currentTranslation: data.translation,
          isProcessing: false
        });
      },

      handleSegmentCreated: (data: any) => {
        console.log('📦 新分段创建:', data.segment.id);
        const { segments } = get();
        set({
          segments: [...segments, data.segment],
          // 分段创建后，清空当前显示的文本，准备下一分段
          currentText: '',
          currentTranslation: '',
          isProcessing: false
        });
      },

      handleError: (data: any) => {
        console.error('❌ WAV流式处理错误:', data);
        const errorMessage = data.message || '未知错误';
        get().setError(errorMessage);
        set({ isProcessing: false });
      },

      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      generateSummaryAndSave: async () => {
        try {
          const { segments } = get();
          if (segments.length === 0) return;

          console.log('📊 开始生成面试总结...');
          
          // 导入总结服务
          const { GPT4InterviewSummaryService } = await import('@/services/interview-summary/gpt4-summary-service');
          const { EnhancedInterviewStorageService } = await import('@/services/storage/enhanced-interview-storage');
          
          const summaryService = new GPT4InterviewSummaryService();
          const storageService = new EnhancedInterviewStorageService();
          
          // 生成总结
          const summary = await summaryService.generateInterviewSummary(segments);
          
          // 创建面试会话记录
          const interviewSession = {
            id: `interview-${Date.now()}`,
            timestamp: new Date(),
            lastUpdated: new Date(),
            candidateName: '未指定候选人',
            position: '未指定职位',
            interviewerName: '面试官',
            company: '',
            recordingSession: {
              id: `recording-${Date.now()}`,
              startTime: new Date(),
              endTime: new Date(),
              duration: 0,
              status: 'completed' as const,
              audioConfig: {
                microphoneEnabled: true,
                systemAudioEnabled: false,
                sampleRate: 16000,
                channels: 1,
                format: 'wav'
              },
              audioQualityHistory: [],
              averageAudioQuality: 0.8
            },
            segments: segments,
            rawTranscriptionText: segments.map((seg: any) => seg.text).join(' '),
            rawTranslationText: segments.map((seg: any) => seg.translation).join(' '),
            summary: summary,
            statistics: {
              totalWords: segments.reduce((sum: number, seg: any) => sum + (seg.wordCount || 0), 0),
              totalQuestions: 0,
              speakerChangeCount: 0,
              averageSegmentDuration: 0,
              longestSegmentDuration: 0,
              speakingTimeDistribution: {
                interviewer: 0,
                candidate: 0,
                unknown: 0
              },
              interactionMetrics: {
                responseTime: [],
                questionDepth: 0,
                engagementScore: 0
              }
            },
            tags: [],
            category: 'mixed' as const,
            difficulty: 'mid' as const,
            metadata: {
              recordingQuality: 'high' as const,
              processingVersion: '1.0.0'
            },
            status: 'completed' as const,
            isBookmarked: false,
            confidentialityLevel: 'internal' as const
          };
          
          // 保存到本地存储
          await storageService.saveSession(interviewSession);
          
          console.log('✅ 面试总结生成并保存成功');
          
        } catch (error) {
          console.error('❌ 生成总结失败:', error);
          get().setError(`生成总结失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      reset: () => {
        const { streamingService } = get();
        if (streamingService) {
          streamingService.stopStreaming();
        }
        set(initialState);
      }
    }),
    {
      name: 'wav-streaming-store',
    }
  )
);