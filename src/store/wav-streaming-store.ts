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
  lastSavedTimestamp: number | null;
  interviewInfo: {
    candidateName: string;
    position: string;
  } | null;
  config: {
    chunkInterval: number;
    translationDelay: number;
  };
}

interface WAVStreamingActions {
  startStreaming: (interviewInfo?: { candidateName: string; position: string }) => Promise<void>;
  stopStreaming: () => Promise<void>;
  generateSummaryAndSave: () => Promise<any>;
  saveInterviewSession: () => Promise<void>;
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
  lastSavedTimestamp: null,
  interviewInfo: null,
  config: {
    chunkInterval: 3000,
    translationDelay: 1000
  }
};

export const useWAVStreamingStore = create<WAVStreamingStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startStreaming: async (interviewInfo?: { candidateName: string; position: string }) => {
        try {
          console.log('🎵 启动WAV流式处理', interviewInfo);
          
          const { config } = get();
          
          // 保存面试信息
          set({ interviewInfo });
          
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
          const { streamingService, segments } = get();
          
          if (streamingService) {
            await streamingService.stopStreaming();
          }
          
          // 🏗️ 自动保存面试会话（即使没有转录内容也保存基础记录）
          console.log('🔍 停止录制检查 - segments数量:', segments.length);
          try {
            console.log('💾 开始自动保存面试会话...');
            await get().saveInterviewSession();
            console.log('✅ 面试会话已自动保存到历史记录');
          } catch (error) {
            console.error('❌ 自动保存面试会话失败:', error);
          }
          
          set({ 
            streamingService: null,
            isActive: false,
            isProcessing: false,
            currentText: '',
            currentTranslation: '',
            error: null
            // 注意：不清空 segments，保留转录数据供后续使用
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

      saveInterviewSession: async () => {
        try {
          const { segments, lastSavedTimestamp } = get();
          console.log('💾 saveInterviewSession 被调用，segments数量:', segments.length);
          
          // 防止短时间内重复保存（5秒内不重复保存）
          const now = Date.now();
          if (lastSavedTimestamp && (now - lastSavedTimestamp) < 5000) {
            console.log('⚠️ 距离上次保存时间过短，跳过重复保存');
            return;
          }

          console.log('💾 保存基础面试会话...');
          
          // 导入存储服务
          const { EnhancedInterviewStorageService } = await import('@/services/storage/enhanced-interview-storage');
          const storageService = new EnhancedInterviewStorageService();
          
          // 使用保存的面试信息
          const { interviewInfo } = get();
          const candidateName = interviewInfo?.candidateName || 'unknown';
          const position = interviewInfo?.position || '未指定职位';
          const company = '';
          
          // 创建基础面试会话记录（不包含总结）
          const interviewSession = {
            id: `interview-${Date.now()}`,
            timestamp: new Date(),
            lastUpdated: new Date(),
            candidateName,
            position,
            interviewerName: '面试官',
            company,
            category: 'technical' as const,
            difficulty: 'mid' as const,
            tags: [],
            recordingSession: {
              id: `recording-${Date.now()}`,
              startTime: new Date(Date.now() - segments.length * 30000), // 估算开始时间
              endTime: new Date(),
              duration: segments.length * 30, // 估算时长（秒）
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
            segments: segments.length > 0 ? segments.map((seg: any) => ({
              ...seg,
              timestamp: new Date(seg.timestamp || Date.now()),
              startTime: seg.startTime || 0,
              endTime: seg.endTime || 30,
              englishText: seg.text || seg.englishText || '',
              chineseText: seg.translation || seg.chineseText || '',
              speaker: seg.speaker || 'unknown',
              confidence: seg.confidence || 0.8
            })) : [{
              id: `empty-segment-${Date.now()}`,
              timestamp: new Date(),
              startTime: 0,
              endTime: 30,
              englishText: '(无转录内容)',
              chineseText: '(无转录内容)',
              speaker: 'unknown',
              confidence: 0
            }],
            rawTranscriptionText: segments.map((seg: any) => seg.text || seg.englishText || '').join(' '),
            rawTranslationText: segments.map((seg: any) => seg.translation || seg.chineseText || '').join(' '),
            statistics: {
              totalWords: segments.reduce((count: number, seg: any) => 
                count + (seg.text || seg.englishText || '').split(' ').length, 0),
              totalQuestions: segments.filter((seg: any) => 
                (seg.text || seg.englishText || '').includes('?')).length,
              speakerChangeCount: new Set(segments.map((seg: any) => seg.speaker)).size,
              averageSegmentDuration: segments.length > 0 ? 
                segments.reduce((sum: number, seg: any) => sum + (seg.endTime - seg.startTime || 30), 0) / segments.length : 0,
              longestSegmentDuration: segments.length > 0 ? 
                Math.max(...segments.map((seg: any) => seg.endTime - seg.startTime || 30)) : 0,
              speakingTimeDistribution: {
                interviewer: segments.filter((seg: any) => seg.speaker === 'interviewer')
                  .reduce((sum: number, seg: any) => sum + (seg.endTime - seg.startTime || 30), 0),
                candidate: segments.filter((seg: any) => seg.speaker === 'candidate')
                  .reduce((sum: number, seg: any) => sum + (seg.endTime - seg.startTime || 30), 0),
                unknown: segments.filter((seg: any) => !seg.speaker || seg.speaker === 'unknown')
                  .reduce((sum: number, seg: any) => sum + (seg.endTime - seg.startTime || 30), 0)
              },
              interactionMetrics: {
                responseTime: [],
                questionDepth: 3,
                engagementScore: 0.7
              }
            },
            metadata: {
              deviceInfo: navigator.userAgent || 'Unknown',
              browserInfo: navigator.userAgent || 'Unknown',
              networkQuality: 'good' as const,
              recordingQuality: 'high' as const,
              processingVersion: '1.0.0'
            },
            status: 'completed' as const,
            isBookmarked: false,
            confidentialityLevel: 'internal' as const
            // 注意：没有 summary 和 summaryGenerationStatus
          };
          
          // 保存到本地存储
          await storageService.saveSession(interviewSession);
          
          // 更新最后保存时间戳
          set({ lastSavedTimestamp: now });
          
          console.log('✅ 基础面试会话保存成功');
          
        } catch (error) {
          console.error('❌ 保存基础面试会话失败:', error);
          throw error;
        }
      },

      generateSummaryAndSave: async () => {
        try {
          const { segments, interviewInfo } = get();
          if (segments.length === 0) return;

          console.log('📊 开始生成面试总结...');
          
          // 导入总结服务
          const { GPT4InterviewSummaryService } = await import('@/services/interview-summary/gpt4-summary-service');
          const { EnhancedInterviewStorageService } = await import('@/services/storage/enhanced-interview-storage');
          
          const summaryService = new GPT4InterviewSummaryService();
          const storageService = new EnhancedInterviewStorageService();
          
          // 生成总结（传入面试信息）
          const summary = await summaryService.generateInterviewSummary(
            segments, 
            undefined, 
            interviewInfo || undefined
          );
          
          // 创建面试会话记录
          const interviewSession = {
            id: `interview-${Date.now()}`,
            timestamp: new Date(),
            lastUpdated: new Date(),
            candidateName: interviewInfo?.candidateName || 'unknown',
            position: interviewInfo?.position || '未指定职位',
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
          
          return summary;
          
        } catch (error) {
          console.error('❌ 生成总结失败:', error);
          get().setError(`生成总结失败: ${error instanceof Error ? error.message : '未知错误'}`);
          throw error;
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