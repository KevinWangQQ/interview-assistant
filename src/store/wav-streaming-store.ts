// 🎵 WAV流式Store - 使用WAV格式确保Whisper兼容

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { EnhancedWAVStreamingTranscriptionService } from '@/services/streaming/enhanced-wav-streaming-transcription';

interface WAVStreamingState {
  isActive: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  currentText: string;
  currentTranslation: string;
  segments: any[];
  completedSegments: any[]; // 已完成的面试段落
  streamingService: EnhancedWAVStreamingTranscriptionService | null;
  error: string | null;
  lastSavedTimestamp: number | null;
  interviewInfo: {
    candidateName: string;
    position: string;
  } | null;
  interviewSummary: any | null; // 面试总结
  isGeneratingSummary: boolean; // 是否正在生成总结
  config: {
    chunkInterval: number;
    translationDelay: number;
  };
}

interface WAVStreamingActions {
  startStreaming: (interviewInfo?: { candidateName: string; position: string }) => Promise<void>;
  stopStreaming: () => Promise<void>;
  pauseStreaming: () => Promise<void>;
  resumeStreaming: () => Promise<void>;
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
  isPaused: false,
  isProcessing: false,
  currentText: '',
  currentTranslation: '',
  segments: [],
  completedSegments: [],
  streamingService: null,
  error: null,
  lastSavedTimestamp: null,
  interviewInfo: null,
  interviewSummary: null,
  isGeneratingSummary: false,
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
          
          // 清理之前的状态，开始全新的面试
          set({
            currentText: '',
            currentTranslation: '',
            segments: [],
            completedSegments: [],
            isProcessing: false,
            error: null,
            lastSavedTimestamp: null,
            interviewInfo,
            interviewSummary: null,
            isGeneratingSummary: false
          });
          
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
          const { streamingService, segments, currentText, currentTranslation } = get();
          
          if (streamingService) {
            await streamingService.stopStreaming();
          }
          
          // 将segments和当前活跃内容合并到completedSegments
          const allSegments = currentText && currentTranslation
            ? [
                ...segments,
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
            : [...segments];
          
          // 🏗️ 自动保存面试会话（即使没有转录内容也保存基础记录）
          console.log('🔍 停止录制检查 - segments数量:', allSegments.length);
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
            segments: [], // 清空实时segments，避免显示问题
            completedSegments: allSegments, // 保存完成的段落到store
            error: null
          });
          
          console.log('✅ WAV流式处理已停止');
        } catch (error) {
          console.error('❌ 停止WAV流式处理失败:', error);
        }
      },

      pauseStreaming: async () => {
        try {
          const { streamingService } = get();
          
          if (streamingService) {
            await streamingService.pauseStreaming();
          }
          
          set({ 
            isPaused: true,
            isProcessing: false
          });
          
          console.log('⏸️ WAV流式处理已暂停');
        } catch (error) {
          console.error('❌ 暂停WAV流式处理失败:', error);
          get().setError(`暂停失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      resumeStreaming: async () => {
        try {
          const { streamingService } = get();
          
          if (streamingService) {
            await streamingService.resumeStreaming();
          }
          
          set({ 
            isPaused: false,
            isProcessing: true
          });
          
          console.log('▶️ WAV流式处理已恢复');
        } catch (error) {
          console.error('❌ 恢复WAV流式处理失败:', error);
          get().setError(`恢复失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
              duration: segments.length > 0 ? 
                Math.max(...segments.map((seg: any) => seg.endTime || 0)) || 
                segments.length * 30 : 0, // 使用实际时长或估算时长
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
              totalWords: segments.reduce((count: number, seg: any) => {
                const text = seg.text || seg.englishText || '';
                return count + (text ? text.split(/\s+/).filter((word: string) => word.length > 0).length : 0);
              }, 0),
              totalQuestions: segments.filter((seg: any) => {
                const text = seg.text || seg.englishText || '';
                return text.includes('?');
              }).length,
              speakerChangeCount: Math.max(1, new Set(segments.map((seg: any) => seg.speaker || 'unknown')).size),
              averageSegmentDuration: segments.length > 0 ? 
                segments.reduce((sum: number, seg: any) => {
                  const duration = (seg.endTime || 0) - (seg.startTime || 0);
                  return sum + Math.max(duration > 0 ? duration : 30, 30);
                }, 0) / segments.length : 30,
              longestSegmentDuration: segments.length > 0 ? 
                Math.max(...segments.map((seg: any) => {
                  const duration = (seg.endTime || 0) - (seg.startTime || 0);
                  return Math.max(duration > 0 ? duration : 30, 30);
                })) : 30,
              speakingTimeDistribution: {
                interviewer: segments.filter((seg: any) => seg.speaker === 'interviewer')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0),
                candidate: segments.filter((seg: any) => seg.speaker === 'candidate')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0),
                unknown: segments.filter((seg: any) => !seg.speaker || seg.speaker === 'unknown')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0)
              },
              interactionMetrics: {
                responseTime: [],
                questionDepth: Math.max(1, Math.min(segments.length, 5)),
                engagementScore: Math.min(0.9, 0.5 + (segments.length * 0.05))
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
          const { segments, completedSegments, interviewInfo } = get();
          const allSegments = completedSegments.length > 0 ? completedSegments : segments;
          
          if (allSegments.length === 0) {
            console.log('⚠️ 无面试内容，跳过总结生成');
            return;
          }

          // 计算面试时长和有效性
          const totalDuration = allSegments.length > 0 ? 
            Math.max(...allSegments.map((seg: any) => seg.endTime || 30)) : 0;
          const totalWords = allSegments.reduce((count: number, seg: any) => {
            const text = seg.englishText || seg.text || '';
            return count + (text ? text.split(/\s+/).filter((word: string) => word.length > 0).length : 0);
          }, 0);

          console.log('📊 面试数据检查:', {
            duration: `${Math.floor(totalDuration / 60)}分${totalDuration % 60}秒`,
            totalWords,
            segments: allSegments.length
          });

          // 判断是否为过短面试（少于2分钟或词数少于30）
          const isShortInterview = totalDuration < 120 || totalWords < 30;
          
          if (isShortInterview) {
            console.log('⚠️ 检测到过短面试，生成简化总结');
            
            // 生成过短面试的简化总结
            const shortInterviewSummary = {
              id: `short-summary-${Date.now()}`,
              timestamp: new Date(),
              metadata: {
                duration: Math.floor(totalDuration / 60),
                totalWords,
                interactionCount: allSegments.length,
                questionCount: 0,
                participantCount: 2
              },
              executiveSummary: `面试时长过短（${Math.floor(totalDuration / 60)}分${totalDuration % 60}秒，共${totalWords}词），无法进行有效的综合评估。建议安排更充分的面试时间（至少15-30分钟）以全面了解候选人能力。`,
              candidatePerformance: {
                overall: `由于面试时间较短，难以全面评估候选人表现。建议延长面试时间获取更多信息。`,
                strengths: totalWords > 0 ? ["能够进行基本交流"] : [],
                weaknesses: ["面试时间不足，信息收集有限"],
                communicationSkills: "时间不足，无法充分评估",
                technicalSkills: "时间不足，无法充分评估"
              },
              keyInsights: {
                standoutMoments: [],
                concerningAreas: ["面试时间过短", "信息收集不充分"],
                improvementSuggestions: [
                  "安排至少15-30分钟的正式面试时间",
                  "准备结构化的面试问题",
                  "确保音频设备工作正常，获得清晰的录音"
                ]
              },
              recommendation: {
                decision: 'neutral' as const,
                reasoning: "由于面试时间过短，无法做出可靠的录用建议。需要重新安排更充分的面试来全面评估候选人能力。",
                nextSteps: [
                  "重新安排15-30分钟的正式面试",
                  "准备针对岗位的具体面试问题",
                  "确保面试环境和设备符合要求"
                ]
              },
              sourceSegments: allSegments.map((seg: any) => seg.id),
              processingStats: {
                totalChunks: 1,
                processingTime: 0,
                confidenceScore: 0.1
              }
            };

            set({ 
              interviewSummary: shortInterviewSummary,
              isGeneratingSummary: false 
            });
            
            console.log('✅ 过短面试简化总结生成完成');
            return shortInterviewSummary;
          }

          console.log('📊 开始生成完整面试总结...');
          set({ isGeneratingSummary: true });
          
          // 导入总结服务
          const { GPT4InterviewSummaryService } = await import('@/services/interview-summary/gpt4-summary-service');
          const { EnhancedInterviewStorageService } = await import('@/services/storage/enhanced-interview-storage');
          
          const summaryService = new GPT4InterviewSummaryService();
          const storageService = new EnhancedInterviewStorageService();
          
          // 生成总结（传入面试信息）
          const summary = await summaryService.generateInterviewSummary(
            allSegments, 
            undefined, 
            interviewInfo || undefined
          );
          
          // 保存总结到store
          set({ 
            interviewSummary: summary,
            isGeneratingSummary: false 
          });
          
          // 创建面试会话记录 - 使用正确的统计计算
          const sessionTotalDuration = allSegments.length > 0 ? 
            Math.max(...allSegments.map((seg: any) => seg.endTime || 30)) : 0;
          
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
              startTime: new Date(Date.now() - (sessionTotalDuration * 1000)),
              endTime: new Date(),
              duration: sessionTotalDuration,
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
            segments: allSegments,
            rawTranscriptionText: allSegments.map((seg: any) => seg.englishText || seg.text || '').join(' '),
            rawTranslationText: allSegments.map((seg: any) => seg.chineseText || seg.translation || '').join(' '),
            summary: summary,
            statistics: {
              totalWords: allSegments.reduce((count: number, seg: any) => {
                const text = seg.englishText || seg.text || '';
                return count + (text ? text.split(/\s+/).filter((word: string) => word.length > 0).length : 0);
              }, 0),
              totalQuestions: allSegments.filter((seg: any) => {
                const text = seg.englishText || seg.text || '';
                return text.includes('?');
              }).length,
              speakerChangeCount: Math.max(1, new Set(allSegments.map((seg: any) => seg.speaker || 'unknown')).size),
              averageSegmentDuration: allSegments.length > 0 ? 
                allSegments.reduce((sum: number, seg: any) => {
                  const duration = (seg.endTime || 0) - (seg.startTime || 0);
                  return sum + Math.max(duration > 0 ? duration : 30, 30);
                }, 0) / allSegments.length : 30,
              longestSegmentDuration: allSegments.length > 0 ? 
                Math.max(...allSegments.map((seg: any) => {
                  const duration = (seg.endTime || 0) - (seg.startTime || 0);
                  return Math.max(duration > 0 ? duration : 30, 30);
                })) : 30,
              speakingTimeDistribution: {
                interviewer: allSegments.filter((seg: any) => seg.speaker === 'interviewer')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0),
                candidate: allSegments.filter((seg: any) => seg.speaker === 'candidate')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0),
                unknown: allSegments.filter((seg: any) => !seg.speaker || seg.speaker === 'unknown')
                  .reduce((sum: number, seg: any) => {
                    const duration = (seg.endTime || 0) - (seg.startTime || 0);
                    return sum + Math.max(duration > 0 ? duration : 30, 30);
                  }, 0)
              },
              interactionMetrics: {
                responseTime: [],
                questionDepth: Math.max(1, Math.min(allSegments.length, 5)),
                engagementScore: Math.min(0.9, 0.5 + (allSegments.length * 0.05))
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
          set({ isGeneratingSummary: false });
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