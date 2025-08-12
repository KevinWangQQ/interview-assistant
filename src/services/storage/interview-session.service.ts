// 🎤 面试会话管理服务 - 专注于面试会话和转录片段的管理

import { createClientComponentClient } from '@/lib/supabase/client';
import { InterviewSession, TranscriptionSegment } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export class InterviewSessionService {
  private supabase: SupabaseClient;
  private userId: string | null = null;

  constructor() {
    this.supabase = createClientComponentClient();
  }

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  // 面试会话管理
  async saveInterviewSession(session: Omit<InterviewSession, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { data, error } = await this.supabase
        .from('interview_sessions')
        .insert({
          ...session,
          user_id: this.userId
        })
        .select()
        .single();

      if (error || !data) {
        throw error || new Error('保存面试会话失败');
      }

      return data.id;

    } catch (error) {
      console.error('❌ 保存面试会话失败:', error);
      throw error;
    }
  }

  async getInterviewSession(sessionId: string): Promise<InterviewSession | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await this.supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return {
        ...data,
        recordingSession: data.recording_session || {},
        metadata: data.metadata || {},
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at)
      };

    } catch (error) {
      console.error('❌ 获取面试会话失败:', error);
      return null;
    }
  }

  async updateInterviewSession(sessionId: string, updates: Partial<InterviewSession>): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('interview_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 更新面试会话失败:', error);
      throw error;
    }
  }

  async deleteInterviewSession(sessionId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('interview_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 删除面试会话失败:', error);
      throw error;
    }
  }

  async getInterviewSessions(options: {
    limit?: number;
    offset?: number;
    status?: string;
    candidate?: string;
  } = {}): Promise<InterviewSession[]> {
    if (!this.userId) return [];

    try {
      let query = this.supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.candidate) {
        query = query.ilike('candidate_name', `%${options.candidate}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data || []).map(session => ({
        ...session,
        recordingSession: session.recording_session || {},
        metadata: session.metadata || {},
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at)
      }));

    } catch (error) {
      console.error('❌ 获取面试会话列表失败:', error);
      return [];
    }
  }

  // 转录片段管理
  async saveTranscriptionSegments(sessionId: string, segments: Omit<TranscriptionSegment, 'id' | 'session_id' | 'created_at'>[]): Promise<void> {
    if (!this.userId || segments.length === 0) return;

    try {
      const segmentsToInsert = segments.map(segment => ({
        session_id: sessionId,
        original_text: segment.originalText,
        translated_text: segment.translatedText,
        start_time: (segment as any).startTime || segment.timestamp,
        end_time: (segment as any).endTime || segment.timestamp,
        speaker_info: (segment as any).speakerInfo || {},
        metadata: (segment as any).metadata || {}
      }));

      const { error } = await this.supabase
        .from('transcription_segments')
        .insert(segmentsToInsert);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 保存转录片段失败:', error);
      throw error;
    }
  }

  async getTranscriptionSegments(sessionId: string): Promise<TranscriptionSegment[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await this.supabase
        .from('transcription_segments')
        .select('*')
        .eq('session_id', sessionId)
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      return (data || []).map(segment => ({
        id: segment.id,
        session_id: segment.session_id,
        originalText: segment.original_text,
        translatedText: segment.translated_text,
        timestamp: new Date(segment.start_time).getTime(),
        speaker: segment.speaker_info?.name || '',
        confidence: segment.metadata?.confidence || 0.95,
        startTime: segment.start_time,
        endTime: segment.end_time,
        speakerInfo: segment.speaker_info || {},
        metadata: segment.metadata || {},
        created_at: new Date(segment.created_at)
      })) as TranscriptionSegment[];

    } catch (error) {
      console.error('❌ 获取转录片段失败:', error);
      return [];
    }
  }

  // 搜索和统计功能
  async searchInterviewSessions(query: string, options: {
    limit?: number;
    searchFields?: ('candidate_name' | 'position' | 'notes')[];
  } = {}): Promise<InterviewSession[]> {
    if (!this.userId) return [];

    const { limit = 50, searchFields = ['candidate_name', 'position', 'notes'] } = options;

    try {
      let supabaseQuery = this.supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .limit(limit);

      // 构建搜索条件
      const searchConditions = searchFields.map(field => `${field}.ilike.%${query}%`);
      if (searchConditions.length > 0) {
        supabaseQuery = supabaseQuery.or(searchConditions.join(','));
      }

      const { data, error } = await supabaseQuery.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(session => ({
        ...session,
        recordingSession: session.recording_session || {},
        metadata: session.metadata || {},
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at)
      }));

    } catch (error) {
      console.error('❌ 搜索面试会话失败:', error);
      return [];
    }
  }

  async getInterviewStats(): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalDuration: number;
    averageRating: number;
  }> {
    if (!this.userId) {
      return { totalSessions: 0, completedSessions: 0, totalDuration: 0, averageRating: 0 };
    }

    try {
      const { data, error } = await this.supabase
        .from('interview_sessions')
        .select('status, duration, overall_rating')
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      const sessions = data || [];
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const ratingsWithValue = sessions.filter(s => s.overall_rating != null);
      const averageRating = ratingsWithValue.length > 0 
        ? ratingsWithValue.reduce((sum, s) => sum + s.overall_rating, 0) / ratingsWithValue.length 
        : 0;

      return {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        totalDuration,
        averageRating
      };

    } catch (error) {
      console.error('❌ 获取面试统计失败:', error);
      return { totalSessions: 0, completedSessions: 0, totalDuration: 0, averageRating: 0 };
    }
  }

  // 批量操作
  async bulkUpdateSessions(updates: Array<{
    id: string;
    data: Partial<InterviewSession>;
  }>): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      for (const { id, data } of updates) {
        await this.updateInterviewSession(id, data);
      }
    } catch (error) {
      console.error('❌ 批量更新面试会话失败:', error);
      throw error;
    }
  }

  async bulkDeleteSessions(sessionIds: string[]): Promise<void> {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    try {
      const { error } = await this.supabase
        .from('interview_sessions')
        .delete()
        .in('id', sessionIds)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

    } catch (error) {
      console.error('❌ 批量删除面试会话失败:', error);
      throw error;
    }
  }
}