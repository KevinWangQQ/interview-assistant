// 面试历史记录Store - 简化版本

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { InterviewSession } from '@/types';

interface InterviewHistoryState {
  sessions: InterviewSession[];
  isLoading: boolean;
  error: string | null;
}

interface InterviewHistoryActions {
  loadSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

type InterviewHistoryStore = InterviewHistoryState & InterviewHistoryActions;

const initialState: InterviewHistoryState = {
  sessions: [],
  isLoading: false,
  error: null
};

export const useInterviewHistoryStore = create<InterviewHistoryStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadSessions: async () => {
        try {
          set({ isLoading: true, error: null });
          
          // 从localStorage加载历史记录
          const stored = localStorage.getItem('interview-sessions');
          const sessions = stored ? JSON.parse(stored) : [];
          
          set({ sessions, isLoading: false });
        } catch (error) {
          console.error('加载面试历史失败:', error);
          set({ 
            error: '加载历史记录失败', 
            isLoading: false 
          });
        }
      },

      deleteSession: async (sessionId: string) => {
        try {
          const { sessions } = get();
          const updatedSessions = sessions.filter(s => s.id !== sessionId);
          
          // 更新localStorage
          localStorage.setItem('interview-sessions', JSON.stringify(updatedSessions));
          
          set({ sessions: updatedSessions });
        } catch (error) {
          console.error('删除面试记录失败:', error);
          set({ error: '删除记录失败' });
        }
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'interview-history-store',
    }
  )
);