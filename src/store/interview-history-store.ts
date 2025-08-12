// 面试历史记录Store - 使用增强版存储服务

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { InterviewSessionService } from '@/services/storage/interview-session.service';

interface InterviewHistoryState {
  sessions: EnhancedInterviewSession[];
  isLoading: boolean;
  error: string | null;
  storageService: InterviewSessionService;
}

interface InterviewHistoryActions {
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportSession: (sessionId: string, format: 'json' | 'txt' | 'csv') => Promise<void>;
  setUserId: (userId: string | null) => void;
  clearError: () => void;
}

type InterviewHistoryStore = InterviewHistoryState & InterviewHistoryActions;

const initialState: InterviewHistoryState = {
  sessions: [],
  isLoading: false,
  error: null,
  storageService: new InterviewSessionService()
};

export const useInterviewHistoryStore = create<InterviewHistoryStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSessions: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { storageService } = get();
          const dbSessions = await storageService.getInterviewSessions();
          
          // 将Supabase数据转换为前端期望的格式
          const sessions: EnhancedInterviewSession[] = dbSessions.map((dbSession: any) => ({
            id: dbSession.id,
            candidateName: dbSession.candidate_name || dbSession.candidateName,
            position: dbSession.position,
            company: dbSession.company || '',
            timestamp: new Date(dbSession.created_at),
            lastUpdated: new Date(dbSession.updated_at),
            status: dbSession.status as 'active' | 'completed' | 'archived' | 'deleted',
            isBookmarked: false, // 暂时硬编码
            category: dbSession.metadata?.category || 'mixed',
            difficulty: dbSession.metadata?.difficulty || 'mid',
            confidentialityLevel: dbSession.metadata?.confidentiality_level || 'internal',
            tags: dbSession.tags || [],
            positionTemplateId: dbSession.position_template_id,
            recordingSession: {
              id: dbSession.id,
              status: dbSession.recording_status,
              duration: dbSession.duration_seconds || 0,
              startTime: new Date(dbSession.created_at),
              endTime: undefined,
              averageAudioQuality: dbSession.audio_quality_avg || 0,
              audioQualityHistory: [],
              audioConfig: {
                microphoneEnabled: true,
                systemAudioEnabled: false,
                sampleRate: 44100,
                channels: 1,
                format: 'wav'
              }
            },
            segments: [], // 需要单独获取
            rawTranscriptionText: '', // 从segments中聚合，暂时为空
            rawTranslationText: '', // 从segments中聚合，暂时为空
            summary: dbSession.summary as any, // 类型兼容处理
            statistics: {
              totalWords: dbSession.total_words || 0,
              totalQuestions: dbSession.total_questions || 0,
              speakerChangeCount: dbSession.speaker_changes || 0,
              averageSegmentDuration: 0,
              longestSegmentDuration: 0,
              speakingTimeDistribution: {
                interviewer: 0,
                candidate: 0,
                unknown: 0
              },
              interactionMetrics: {
                responseTime: [], // 响应时间数组
                questionDepth: 0.5, // 问题深度评分
                engagementScore: 0.5 // 参与度评分
              },
              qualityMetrics: {
                audioQuality: dbSession.audio_quality_avg || 0,
                transcriptionAccuracy: 0.9,
                completionRate: 1.0
              }
            },
            summaryGenerationStatus: dbSession.summary_status ? {
              jobId: dbSession.id,
              status: dbSession.summary_status,
              progress: dbSession.summary_progress || 0,
              startTime: new Date(),
              completedTime: undefined,
              serviceType: 'standard',
              templateUsed: !!dbSession.position_template_id
            } : undefined,
            metadata: dbSession.metadata || {}
          }));
          
          console.log('✅ 加载面试历史记录:', sessions.length);
          set({ sessions, isLoading: false });
        } catch (error) {
          console.error('❌ 加载面试历史失败:', error);
          set({ 
            error: '加载历史记录失败', 
            isLoading: false 
          });
        }
      },

      deleteSession: async (sessionId: string) => {
        try {
          const { storageService } = get();
          await storageService.deleteInterviewSession(sessionId);
          
          // 重新加载会话列表
          const loadSessions = get().loadSessions;
          await loadSessions();
          console.log('✅ 面试记录删除成功');
        } catch (error) {
          console.error('❌ 删除面试记录失败:', error);
          set({ error: '删除记录失败' });
        }
      },

      exportSession: async (sessionId: string, format: 'json' | 'txt' | 'csv') => {
        try {
          const { storageService } = get();
          const session = await storageService.getInterviewSession(sessionId);
          
          if (!session) {
            set({ error: '找不到指定的面试记录' });
            return;
          }

          // 简化的导出逻辑，后续可以扩展
          const exportData = {
            candidateName: (session as any).candidate_name || session.candidateName,
            position: session.position,
            company: (session as any).company || '',
            timestamp: (session as any).created_at || session.startTime,
            duration: (session as any).duration_seconds || 0,
            summary: session.summary
          };

          const timestamp = new Date().toISOString().split('T')[0];
          const filename = `面试记录_${(session as any).candidate_name || session.candidateName}_${timestamp}.${format}`;
          
          let data: string;
          let mimeType: string;
          
          switch (format) {
            case 'json':
              data = JSON.stringify(exportData, null, 2);
              mimeType = 'application/json';
              break;
            case 'csv':
              data = `候选人,职位,公司,时间,时长\n${exportData.candidateName},${exportData.position},${exportData.company || ''},${exportData.timestamp},${exportData.duration}`;
              mimeType = 'text/csv';
              break;
            case 'txt':
              data = `面试记录\n候选人: ${exportData.candidateName}\n职位: ${exportData.position}\n公司: ${exportData.company || ''}\n时间: ${exportData.timestamp}\n时长: ${exportData.duration}秒`;
              mimeType = 'text/plain';
              break;
            default:
              throw new Error(`不支持的格式: ${format}`);
          }

          // 创建下载链接
          const blob = new Blob([data], { type: mimeType });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          
          URL.revokeObjectURL(url);
          
          console.log('✅ 面试记录导出成功:', filename);
        } catch (error) {
          console.error('❌ 导出面试记录失败:', error);
          set({ error: '导出记录失败' });
        }
      },

      setUserId: (userId: string | null) => {
        const { storageService } = get();
        storageService.setUserId(userId);
        console.log('🔗 面试历史存储服务用户ID已设置:', userId);
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'interview-history-store',
    }
  )
);