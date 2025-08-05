// 面试历史记录Store - 使用增强版存储服务

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { EnhancedInterviewSession } from '@/types/enhanced-interview';
import { EnhancedInterviewStorageService } from '@/services/storage/enhanced-interview-storage';

interface InterviewHistoryState {
  sessions: EnhancedInterviewSession[];
  isLoading: boolean;
  error: string | null;
  storageService: EnhancedInterviewStorageService;
}

interface InterviewHistoryActions {
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  exportSession: (sessionId: string, format: 'json' | 'txt' | 'csv') => Promise<void>;
  clearError: () => void;
}

type InterviewHistoryStore = InterviewHistoryState & InterviewHistoryActions;

const initialState: InterviewHistoryState = {
  sessions: [],
  isLoading: false,
  error: null,
  storageService: new EnhancedInterviewStorageService()
};

export const useInterviewHistoryStore = create<InterviewHistoryStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSessions: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const { storageService } = get();
          const sessions = storageService.getAllSessions();
          
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
          const success = await storageService.deleteSession(sessionId);
          
          if (success) {
            const sessions = storageService.getAllSessions();
            set({ sessions });
            console.log('✅ 面试记录删除成功');
          } else {
            set({ error: '删除记录失败：记录不存在' });
          }
        } catch (error) {
          console.error('❌ 删除面试记录失败:', error);
          set({ error: '删除记录失败' });
        }
      },

      exportSession: async (sessionId: string, format: 'json' | 'txt' | 'csv') => {
        try {
          const { storageService } = get();
          const exportResult = await storageService.exportSession(sessionId, {
            format,
            includeSegments: true,
            includeSummary: true,
            includeStatistics: true,
            includeAudioMetrics: false,
            anonymize: false
          });

          // 创建下载链接
          const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = exportResult.filename;
          link.click();
          
          URL.revokeObjectURL(url);
          
          console.log('✅ 面试记录导出成功:', exportResult.filename);
        } catch (error) {
          console.error('❌ 导出面试记录失败:', error);
          set({ error: '导出记录失败' });
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'interview-history-store',
    }
  )
);